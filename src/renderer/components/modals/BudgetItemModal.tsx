import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  IconButton,
  Chip,
  Box,
  Typography,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import AmountInput from '../shared/AmountInput'
import CategoryPicker from '../shared/CategoryPicker'
import { useToast } from '../../contexts/ToastContext'
import { getBudgetItemCategoryIds, getUsedCategoryMap, createBudgetItem, updateBudgetItem } from '../../repositories/budgetRepository'
import { getExpenseCategories } from '../../repositories/categoryRepository'

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
  const { showWarning, showError } = useToast()
  const [saving, setSaving] = useState(false)
  const [categoryPickerAnchor, setCategoryPickerAnchor] = useState<HTMLElement | null>(null)
  const [usedCategoryMap, setUsedCategoryMap] = useState<Record<string, string>>({})

  const isEditMode = !!editItem

  useEffect(() => {
    if (open) {
      loadCategories()
      loadUsedCategories()
      if (editItem) {
        loadEditItemData()
      }
    }
  }, [open, editItem])

  const loadEditItemData = async () => {
    if (!editItem) return

    try {
      const categoryIds = await getBudgetItemCategoryIds(editItem.id)

      setFormData({
        name: editItem.name,
        group_name: editItem.group_name || '',
        base_amount: editItem.base_amount.toLocaleString(),
        currency: editItem.currency,
        memo: editItem.memo || '',
        category_ids: categoryIds,
      })
    } catch (error) {
      console.error('Failed to load edit item data:', error)
    }
  }

  const loadUsedCategories = async () => {
    try {
      const map = await getUsedCategoryMap(editItem?.id || '')
      setUsedCategoryMap(map)
    } catch (error) {
      console.error('Failed to load used categories:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const result = await getExpenseCategories()
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
      showWarning('예산 항목명을 입력해주세요.')
      return
    }

    const amount = parseFloat(formData.base_amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showWarning('금액을 입력해주세요.')
      return
    }

    if (formData.category_ids.length === 0) {
      showWarning('카테고리를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      const data = {
        name: formData.name,
        group_name: formData.group_name || null,
        base_amount: amount,
        currency: formData.currency,
        memo: formData.memo || null,
        category_ids: formData.category_ids,
      }

      if (isEditMode && editItem) {
        await updateBudgetItem(editItem.id, data)
      } else {
        await createBudgetItem(data)
      }

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save budget item:', error)
      showError('예산 항목 저장에 실패했습니다.')
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

          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              연결 카테고리
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {formData.category_ids.map((id) => {
                const cat = categories.find((c) => c.id === id)
                return cat ? (
                  <Chip
                    key={id}
                    label={cat.name}
                    size="small"
                    color="primary"
                    onDelete={() => {
                      handleChange('category_ids', formData.category_ids.filter((cid) => cid !== id))
                    }}
                  />
                ) : null
              })}
              <Chip
                label={formData.category_ids.length === 0 ? '카테고리 선택' : '+'}
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
              multiSelect
              selectedCategoryIds={formData.category_ids}
              disabledCategoryMap={usedCategoryMap}
              onSelect={(categoryId) => {
                const ids = formData.category_ids.includes(categoryId)
                  ? formData.category_ids.filter((id) => id !== categoryId)
                  : [...formData.category_ids, categoryId]
                handleChange('category_ids', ids)
              }}
            />
          </Box>

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
