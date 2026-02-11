import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Chip,
  Box,
  Typography,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'

interface BudgetItem {
  id: string
  name: string
  group_name: string | null
  base_amount: number
  currency: string
  memo: string | null
  category_ids?: string[]
}

interface BudgetItemModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editItem?: BudgetItem | null
}

interface Category {
  id: string
  name: string
  type: string
  expense_type: string | null
}

export default function BudgetItemModal({ open, onClose, onSaved, editItem }: BudgetItemModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    name: '',
    group_name: '',
    base_amount: '',
    currency: 'KRW',
    memo: '',
    category_ids: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const isEditMode = !!editItem

  useEffect(() => {
    if (open) {
      loadCategories()
      if (editItem) {
        loadEditItemData()
      }
    }
  }, [open, editItem])

  const loadEditItemData = async () => {
    if (!editItem) return

    try {
      // 연결된 카테고리 조회
      const categoryResult = await window.electronAPI.db.query(
        'SELECT category_id FROM budget_item_categories WHERE budget_item_id = ?',
        [editItem.id]
      ) as { category_id: string }[]

      setFormData({
        name: editItem.name,
        group_name: editItem.group_name || '',
        base_amount: editItem.base_amount.toLocaleString(),
        currency: editItem.currency,
        memo: editItem.memo || '',
        category_ids: categoryResult.map((r) => r.category_id),
      })
    } catch (error) {
      console.error('Failed to load edit item data:', error)
    }
  }

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

  const handleChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // AmountInput에서 금액과 통화 변경 처리
  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, base_amount: amount, currency }))
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
      if (isEditMode && editItem) {
        await window.electronAPI.db.query(
          `UPDATE budget_items SET name = ?, group_name = ?, base_amount = ?, currency = ?, memo = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            formData.name,
            formData.group_name || null,
            amount,
            formData.currency,
            formData.memo || null,
            editItem.id,
          ]
        )

        // 기존 카테고리 매핑 삭제 후 재등록
        await window.electronAPI.db.query(
          'DELETE FROM budget_item_categories WHERE budget_item_id = ?',
          [editItem.id]
        )

        for (const categoryId of formData.category_ids) {
          await window.electronAPI.db.query(
            `INSERT INTO budget_item_categories (id, budget_item_id, category_id)
             VALUES (?, ?, ?)`,
            [uuidv4(), editItem.id, categoryId]
          )
        }
      } else {
        // 추가 모드
        const budgetItemId = uuidv4()

        await window.electronAPI.db.query(
          `INSERT INTO budget_items (id, name, group_name, base_amount, currency, memo)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            budgetItemId,
            formData.name,
            formData.group_name || null,
            amount,
            formData.currency,
            formData.memo || null,
          ]
        )

        for (const categoryId of formData.category_ids) {
          await window.electronAPI.db.query(
            `INSERT INTO budget_item_categories (id, budget_item_id, category_id)
             VALUES (?, ?, ?)`,
            [uuidv4(), budgetItemId, categoryId]
          )
        }
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
      group_name: '',
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
        {isEditMode ? '예산 항목 수정' : '예산 항목 추가'}
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="예산명"
            placeholder="예: 식비, 통신비, 교육비"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
          />

          <AmountInput
            label="월 예산 금액"
            value={formData.base_amount}
            currency={formData.currency}
            onChange={handleAmountChange}
            sx={{ width: '100%' }}
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
          {saving ? '저장 중...' : isEditMode ? '수정' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
