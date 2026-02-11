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
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'
import CategoryPicker from '../shared/CategoryPicker'

interface AutoTransactionRule {
  id: string
  name: string
  rule_type: string
  base_amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  valid_from: string | null
  valid_to: string | null
  memo: string | null
  category_name?: string | null
  account_name?: string | null
}

interface Account {
  id: string
  name: string
  owner: string
  currency: string
}

interface Category {
  id: string
  name: string
  type: string
  expense_type: string | null
}

interface AutoTransactionRuleModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editItem?: AutoTransactionRule | null
  defaultRuleType?: string
}

export default function AutoTransactionRuleModal({ open, onClose, onSaved, editItem, defaultRuleType }: AutoTransactionRuleModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [formData, setFormData] = useState({
    name: '',
    rule_type: defaultRuleType || 'distributed',
    base_amount: '',
    currency: 'KRW',
    category_id: '',
    account_id: '',
    valid_from: '',
    valid_to: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)
  const [categoryPickerAnchor, setCategoryPickerAnchor] = useState<HTMLElement | null>(null)

  const isEditMode = !!editItem

  useEffect(() => {
    if (open) {
      loadCategories()
      loadAccounts()
      if (editItem) {
        setFormData({
          name: editItem.name,
          rule_type: editItem.rule_type,
          base_amount: editItem.base_amount.toLocaleString(),
          currency: editItem.currency,
          category_id: editItem.category_id || '',
          account_id: editItem.account_id || '',
          valid_from: editItem.valid_from || '',
          valid_to: editItem.valid_to || '',
          memo: editItem.memo || '',
        })
      } else {
        resetForm()
      }
    }
  }, [open, editItem])

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.db.query(
        "SELECT * FROM categories WHERE is_active = 1 AND type = 'expense' ORDER BY expense_type, name"
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, base_amount: amount, currency }))
  }

  const getDistributedMonths = () => {
    if (!formData.valid_from || !formData.valid_to) return 0
    const from = new Date(formData.valid_from)
    const to = new Date(formData.valid_to)
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    return Math.max(1, months)
  }

  const getMonthlyAmount = () => {
    const amount = parseFloat(formData.base_amount.replace(/,/g, '')) || 0
    if (formData.rule_type === 'distributed') {
      const months = getDistributedMonths()
      return months > 0 ? Math.round(amount / months) : 0
    }
    return amount
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('이름을 입력해주세요.')
      return
    }

    const amount = parseFloat(formData.base_amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      alert('금액을 입력해주세요.')
      return
    }

    if (formData.rule_type === 'distributed') {
      if (!formData.valid_from || !formData.valid_to) {
        alert('분배 규칙은 시작일과 종료일을 입력해주세요.')
        return
      }
      if (formData.valid_from > formData.valid_to) {
        alert('종료일은 시작일보다 이후여야 합니다.')
        return
      }
    }

    setSaving(true)
    try {
      const accountId = formData.rule_type === 'fixed_monthly' ? (formData.account_id || null) : null

      if (isEditMode && editItem) {
        await window.electronAPI.db.query(
          `UPDATE auto_transaction_rules
           SET name = ?, base_amount = ?, currency = ?, category_id = ?, account_id = ?,
               valid_from = ?, valid_to = ?, memo = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            formData.name,
            amount,
            formData.currency,
            formData.category_id || null,
            accountId,
            formData.valid_from || null,
            formData.valid_to || null,
            formData.memo || null,
            editItem.id,
          ]
        )
      } else {
        await window.electronAPI.db.query(
          `INSERT INTO auto_transaction_rules (id, name, rule_type, base_amount, currency, category_id, account_id, valid_from, valid_to, memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            formData.name,
            formData.rule_type,
            amount,
            formData.currency,
            formData.category_id || null,
            accountId,
            formData.valid_from || null,
            formData.valid_to || null,
            formData.memo || null,
          ]
        )
      }

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save auto transaction rule:', error)
      alert('자동 거래 규칙 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      rule_type: defaultRuleType || 'distributed',
      base_amount: '',
      currency: 'KRW',
      category_id: '',
      account_id: '',
      valid_from: '',
      valid_to: '',
      memo: '',
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEditMode ? '자동 거래 규칙 수정' : '자동 거래 규칙 추가'}
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="이름"
            placeholder="예: 연금보험, 적금"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
          />

          <Typography variant="body2" color="textSecondary" sx={{ bgcolor: 'action.hover', px: 2, py: 1, borderRadius: 1 }}>
            {formData.rule_type === 'distributed'
              ? '분배: 기간 내 총액을 월별로 분배하여 거래 생성'
              : '월 자동 생성: 매월 동일한 금액으로 거래 자동 생성'}
          </Typography>

          {/* 분배 규칙: 유효 기간 */}
          {formData.rule_type === 'distributed' && (
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
              label={formData.rule_type === 'distributed' ? '총 금액' : '월 금액'}
              value={formData.base_amount}
              currency={formData.currency}
              onChange={handleAmountChange}
              sx={{ width: '100%' }}
            />
            {formData.rule_type === 'distributed' && formData.base_amount && formData.valid_from && formData.valid_to && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {getDistributedMonths()}개월 분배 → 월 {formData.currency} {getMonthlyAmount().toLocaleString()}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              카테고리 (선택)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {formData.category_id && (() => {
                const cat = categories.find((c) => c.id === formData.category_id)
                return cat ? (
                  <Chip
                    label={cat.name}
                    size="small"
                    color="primary"
                    onDelete={() => handleChange('category_id', '')}
                  />
                ) : null
              })()}
              <Chip
                label={formData.category_id ? '변경' : '카테고리 선택'}
                size="small"
                variant="outlined"
                onClick={(e) => setCategoryPickerAnchor(e.currentTarget)}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
            <CategoryPicker
              anchorEl={categoryPickerAnchor}
              onClose={() => setCategoryPickerAnchor(null)}
              transactionType="expense"
              selectedCategoryId={formData.category_id}
              onSelect={(categoryId) => handleChange('category_id', categoryId)}
            />
          </Box>

          {/* 월 자동 생성: 연결 계좌 */}
          {formData.rule_type === 'fixed_monthly' && (
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

          <TextField
            label="메모"
            placeholder="메모를 입력하세요"
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
