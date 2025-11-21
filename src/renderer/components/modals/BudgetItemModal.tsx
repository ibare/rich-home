import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
  Chip,
  Box,
  Typography,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface BudgetItemModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface Category {
  id: string
  name: string
  type: string
  expense_type: string | null
}

const budgetTypeOptions = [
  { value: 'fixed_monthly', label: '고정 월예산', description: '매월 동일한 금액' },
  { value: 'variable_monthly', label: '변동 월예산', description: '매월 한도 조정 가능' },
  { value: 'annual', label: '연간 분배', description: '연간 금액을 12개월로 분배' },
  { value: 'quarterly', label: '분기 분배', description: '분기 금액을 3개월로 분배' },
]

const currencyOptions = [
  { value: 'KRW', label: 'KRW' },
  { value: 'AED', label: 'AED' },
]

export default function BudgetItemModal({ open, onClose, onSaved }: BudgetItemModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    name: '',
    budget_type: 'fixed_monthly',
    base_amount: '',
    currency: 'KRW',
    memo: '',
    category_ids: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.db.query(
        "SELECT * FROM categories WHERE is_active = 1 AND type = 'expense' ORDER BY expense_type, sort_order"
      )
      setCategories(result as Category[])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const formatNumber = (value: string, currency: string) => {
    const num = value.replace(/[^\d.]/g, '')
    if (num === '') return ''

    // AED는 소수점 2자리까지 허용
    if (currency === 'AED') {
      const parts = num.split('.')
      if (parts.length > 2) return formatNumber(parts[0] + '.' + parts.slice(1).join(''), currency)
      if (parts[1]?.length > 2) {
        parts[1] = parts[1].slice(0, 2)
      }
      const parsed = parseFloat(parts.join('.'))
      if (isNaN(parsed)) return ''
      if (parts.length === 2) {
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
          .replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
          + (num.endsWith('.') ? '.' : (parts[1] === '' ? '.' : ''))
      }
      return parsed.toLocaleString()
    }

    // KRW는 정수만
    const parsed = parseInt(num.split('.')[0], 10)
    if (isNaN(parsed)) return ''
    return parsed.toLocaleString()
  }

  const handleChange = (field: string, value: string | string[]) => {
    if (field === 'currency' && typeof value === 'string') {
      // 통화 변경시 금액 재포맷
      setFormData((prev) => ({
        ...prev,
        currency: value,
        base_amount: prev.base_amount ? formatNumber(prev.base_amount.replace(/,/g, ''), value) : '',
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '.' || !isNaN(parseFloat(raw)) || (raw.endsWith('.') && formData.currency === 'AED')) {
      setFormData((prev) => ({ ...prev, base_amount: formatNumber(raw, prev.currency) }))
    }
  }

  const getAmountLabel = () => {
    switch (formData.budget_type) {
      case 'annual':
        return '연간 금액'
      case 'quarterly':
        return '분기 금액'
      default:
        return '월 예산 금액'
    }
  }

  const getMonthlyAmount = () => {
    const amount = parseFloat(formData.base_amount.replace(/,/g, '')) || 0
    switch (formData.budget_type) {
      case 'annual':
        return Math.round(amount / 12)
      case 'quarterly':
        return Math.round(amount / 3)
      default:
        return amount
    }
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('예산 항목명을 입력해주세요.')
      return
    }

    const amount = parseFloat(formData.base_amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      alert('금액을 입력해주세요.')
      return
    }

    if (formData.category_ids.length === 0) {
      alert('카테고리를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      const budgetItemId = uuidv4()

      // 예산 항목 저장
      await window.electronAPI.db.query(
        `INSERT INTO budget_items (id, name, budget_type, base_amount, currency, memo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          budgetItemId,
          formData.name,
          formData.budget_type,
          amount,
          formData.currency,
          formData.memo || null,
        ]
      )

      // 카테고리 매핑 저장
      for (const categoryId of formData.category_ids) {
        await window.electronAPI.db.query(
          `INSERT INTO budget_item_categories (id, budget_item_id, category_id)
           VALUES (?, ?, ?)`,
          [uuidv4(), budgetItemId, categoryId]
        )
      }

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save budget item:', error)
      alert('예산 항목 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      budget_type: 'fixed_monthly',
      base_amount: '',
      currency: 'KRW',
      memo: '',
      category_ids: [],
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const groupedCategories = {
    fixed: categories.filter((c) => c.expense_type === 'fixed'),
    variable: categories.filter((c) => c.expense_type === 'variable'),
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        예산 항목 추가
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="예산 항목명"
            placeholder="예: 식비, 통신비, 교육비"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
          />

          <FormControl fullWidth>
            <InputLabel>예산 유형</InputLabel>
            <Select
              value={formData.budget_type}
              label="예산 유형"
              onChange={(e) => handleChange('budget_type', e.target.value)}
            >
              {budgetTypeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Box>
                    <Typography>{opt.label}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {opt.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={getAmountLabel()}
            value={formData.base_amount}
            onChange={handleAmountChange}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ),
            }}
            placeholder="0"
            helperText={
              (formData.budget_type === 'annual' || formData.budget_type === 'quarterly') &&
              formData.base_amount
                ? `월 분배액: ${formData.currency} ${getMonthlyAmount().toLocaleString()}`
                : undefined
            }
          />

          <FormControl fullWidth>
            <InputLabel>연결 카테고리</InputLabel>
            <Select
              multiple
              value={formData.category_ids}
              onChange={(e) => handleChange('category_ids', e.target.value as string[])}
              input={<OutlinedInput label="연결 카테고리" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const cat = categories.find((c) => c.id === value)
                    return <Chip key={value} label={cat?.name || value} size="small" />
                  })}
                </Box>
              )}
            >
              {groupedCategories.fixed.length > 0 && (
                <MenuItem disabled>
                  <Typography variant="caption" color="textSecondary">
                    — 고정비 —
                  </Typography>
                </MenuItem>
              )}
              {groupedCategories.fixed.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  <Checkbox checked={formData.category_ids.includes(cat.id)} />
                  <ListItemText primary={cat.name} />
                </MenuItem>
              ))}
              {groupedCategories.variable.length > 0 && (
                <MenuItem disabled>
                  <Typography variant="caption" color="textSecondary">
                    — 변동비 —
                  </Typography>
                </MenuItem>
              )}
              {groupedCategories.variable.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  <Checkbox checked={formData.category_ids.includes(cat.id)} />
                  <ListItemText primary={cat.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>통화</FormLabel>
            <RadioGroup
              row
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              {currencyOptions.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" />}
                  label={opt.label}
                />
              ))}
            </RadioGroup>
          </FormControl>

          <TextField
            label="메모"
            placeholder="예: 3인 가족 기준"
            value={formData.memo}
            onChange={(e) => handleChange('memo', e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          취소
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
