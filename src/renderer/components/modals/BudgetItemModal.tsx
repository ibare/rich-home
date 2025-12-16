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
  budget_type: string
  base_amount: number
  currency: string
  memo: string | null
  valid_from: string | null
  valid_to: string | null
  category_ids?: string[]
  account_id?: string | null
}

interface Account {
  id: string
  name: string
  owner: string
  currency: string
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

const budgetTypeOptions = [
  { value: 'fixed_monthly', label: '고정 월예산', description: '매월 동일한 금액' },
  { value: 'variable_monthly', label: '변동 월예산', description: '매월 한도 조정 가능' },
  { value: 'distributed', label: '분배 예산', description: '기간 내 총액을 월별로 분배' },
]

export default function BudgetItemModal({ open, onClose, onSaved, editItem }: BudgetItemModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [formData, setFormData] = useState({
    name: '',
    group_name: '',
    budget_type: 'fixed_monthly',
    base_amount: '',
    currency: 'KRW',
    memo: '',
    valid_from: '',
    valid_to: '',
    category_ids: [] as string[],
    account_id: '',
  })
  const [saving, setSaving] = useState(false)

  const isEditMode = !!editItem

  useEffect(() => {
    if (open) {
      loadCategories()
      loadAccounts()
      if (editItem) {
        // 수정 모드: 기존 데이터 로드
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
        budget_type: editItem.budget_type,
        base_amount: editItem.base_amount.toLocaleString(),
        currency: editItem.currency,
        memo: editItem.memo || '',
        valid_from: editItem.valid_from || '',
        valid_to: editItem.valid_to || '',
        category_ids: categoryResult.map((r) => r.category_id),
        account_id: editItem.account_id || '',
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

  const loadAccounts = async () => {
    try {
      const result = await window.electronAPI.db.query(
        'SELECT id, name, owner, currency FROM accounts WHERE is_active = 1 ORDER BY owner, name'
      )
      setAccounts(result as Account[])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    }
  }

  const handleChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // AmountInput에서 금액과 통화 변경 처리
  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, base_amount: amount, currency }))
  }

  const getAmountLabel = () => {
    if (formData.budget_type === 'distributed') {
      return '총 금액'
    }
    return '월 예산 금액'
  }

  // 분배 예산의 월 수 계산
  const getDistributedMonths = () => {
    if (!formData.valid_from || !formData.valid_to) return 0
    const from = new Date(formData.valid_from)
    const to = new Date(formData.valid_to)
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    return Math.max(1, months)
  }

  const getMonthlyAmount = () => {
    const amount = parseFloat(formData.base_amount.replace(/,/g, '')) || 0
    if (formData.budget_type === 'distributed') {
      const months = getDistributedMonths()
      return months > 0 ? Math.round(amount / months) : 0
    }
    return amount
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

    // 분배 예산은 기간 필수
    if (formData.budget_type === 'distributed') {
      if (!formData.valid_from || !formData.valid_to) {
        alert('분배 예산은 시작일과 종료일을 입력해주세요.')
        return
      }
      if (formData.valid_from > formData.valid_to) {
        alert('종료일은 시작일보다 이후여야 합니다.')
        return
      }
    }

    setSaving(true)
    try {
      // 고정 예산이 아닌 경우 account_id는 null
      const accountId = formData.budget_type === 'fixed_monthly' ? (formData.account_id || null) : null

      if (isEditMode && editItem) {
        // 수정 모드
        await window.electronAPI.db.query(
          `UPDATE budget_items SET name = ?, group_name = ?, budget_type = ?, base_amount = ?, currency = ?, memo = ?, valid_from = ?, valid_to = ?, account_id = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            formData.name,
            formData.group_name || null,
            formData.budget_type,
            amount,
            formData.currency,
            formData.memo || null,
            formData.valid_from || null,
            formData.valid_to || null,
            accountId,
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
          `INSERT INTO budget_items (id, name, group_name, budget_type, base_amount, currency, memo, valid_from, valid_to, account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            budgetItemId,
            formData.name,
            formData.group_name || null,
            formData.budget_type,
            amount,
            formData.currency,
            formData.memo || null,
            formData.valid_from || null,
            formData.valid_to || null,
            accountId,
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
      budget_type: 'fixed_monthly',
      base_amount: '',
      currency: 'KRW',
      memo: '',
      valid_from: '',
      valid_to: '',
      category_ids: [],
      account_id: '',
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

          {/* 분배 예산 기간 (금액 입력 전에 기간 설정) */}
          {formData.budget_type === 'distributed' && (
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="시작일"
                value={formData.valid_from}
                onChange={(e) => handleChange('valid_from', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
              <TextField
                type="date"
                label="종료일"
                value={formData.valid_to}
                onChange={(e) => handleChange('valid_to', e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
            </Stack>
          )}

          <Box>
            <AmountInput
              label={getAmountLabel()}
              value={formData.base_amount}
              currency={formData.currency}
              onChange={handleAmountChange}
              sx={{ width: '100%' }}
            />
            {formData.budget_type === 'distributed' && formData.base_amount && formData.valid_from && formData.valid_to && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {getDistributedMonths()}개월 분배 → 월 {formData.currency} {getMonthlyAmount().toLocaleString()}
              </Typography>
            )}
          </Box>

          {/* 고정 예산일 경우 계좌 연결 */}
          {formData.budget_type === 'fixed_monthly' && (
            <FormControl fullWidth>
              <InputLabel>연결 계좌 (선택)</InputLabel>
              <Select
                value={formData.account_id}
                label="연결 계좌 (선택)"
                onChange={(e) => handleChange('account_id', e.target.value)}
              >
                <MenuItem value="">
                  <em>선택 안함</em>
                </MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name} ({account.owner === 'self' ? '본인' : account.owner === 'spouse' ? '배우자' : '자녀'} · {account.currency})
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                계좌를 연결하면 자동 거래 생성 시 해당 계좌 잔고에 금액이 합산됩니다.
              </Typography>
            </FormControl>
          )}

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
