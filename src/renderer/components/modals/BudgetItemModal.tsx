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
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'
import CategoryPicker from '../shared/CategoryPicker'

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

  const loadUsedCategories = async () => {
    try {
      const excludeId = editItem?.id || ''
      const result = await window.electronAPI.db.query(
        `SELECT bic.category_id, bi.name as budget_name
         FROM budget_item_categories bic
         JOIN budget_items bi ON bi.id = bic.budget_item_id
         WHERE bi.is_active = 1 AND bi.id != ?`,
        [excludeId]
      ) as { category_id: string; budget_name: string }[]
      const map: Record<string, string> = {}
      for (const row of result) {
        map[row.category_id] = row.budget_name
      }
      setUsedCategoryMap(map)
    } catch (error) {
      console.error('Failed to load used categories:', error)
    }
  }

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
