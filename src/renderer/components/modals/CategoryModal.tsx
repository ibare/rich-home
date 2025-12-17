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
  Box,
  Typography,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  expense_type: 'fixed' | 'variable' | null
  color: string
  icon: string
  is_active: number
  sort_order: number
}

interface CategoryModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editingCategory?: Category | null
}

const typeOptions = [
  { value: 'income', label: '수입' },
  { value: 'expense', label: '지출' },
]

const expenseTypeOptions = [
  { value: 'fixed', label: '고정비' },
  { value: 'variable', label: '변동비' },
]

const colorOptions = [
  '#4CAF50', // green
  '#2196F3', // blue
  '#9C27B0', // purple
  '#FF9800', // orange
  '#F44336', // red
  '#00BCD4', // cyan
  '#E91E63', // pink
  '#795548', // brown
  '#607D8B', // blue-grey
  '#FFC107', // amber
  '#3F51B5', // indigo
  '#009688', // teal
]

export default function CategoryModal({
  open,
  onClose,
  onSaved,
  editingCategory,
}: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    expense_type: 'variable' as 'fixed' | 'variable',
    color: colorOptions[0],
  })
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionCount, setTransactionCount] = useState(0)
  const [replacementCategoryId, setReplacementCategoryId] = useState('')
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])

  const isEditing = !!editingCategory

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        type: editingCategory.type,
        expense_type: editingCategory.expense_type || 'variable',
        color: editingCategory.color,
      })
    } else {
      setFormData({
        name: '',
        type: 'expense',
        expense_type: 'variable',
        color: colorOptions[0],
      })
    }
  }, [editingCategory, open])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('카테고리 이름은 필수입니다.')
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await window.electronAPI.db.query(
          `UPDATE categories
           SET name = ?, type = ?, expense_type = ?, color = ?
           WHERE id = ?`,
          [
            formData.name.trim(),
            formData.type,
            formData.type === 'expense' ? formData.expense_type : null,
            formData.color,
            editingCategory.id,
          ]
        )
      } else {
        // 새 카테고리의 sort_order 결정
        const maxOrderResult = await window.electronAPI.db.get(
          `SELECT MAX(sort_order) as max_order FROM categories WHERE type = ? AND expense_type = ?`,
          [formData.type, formData.type === 'expense' ? formData.expense_type : null]
        )
        const nextOrder = ((maxOrderResult as { max_order: number | null })?.max_order ?? 0) + 1

        await window.electronAPI.db.query(
          `INSERT INTO categories (id, name, type, expense_type, color, icon, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, '', ?, 1)`,
          [
            uuidv4(),
            formData.name.trim(),
            formData.type,
            formData.type === 'expense' ? formData.expense_type : null,
            formData.color,
            nextOrder,
          ]
        )
      }

      onSaved()
      handleClose()
    } catch (error) {
      console.error('Failed to save category:', error)
      alert('카테고리 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      type: 'expense',
      expense_type: 'variable',
      color: colorOptions[0],
    })
    setDeleteDialogOpen(false)
    onClose()
  }

  const handleDeleteClick = async () => {
    if (!editingCategory) return

    try {
      // 해당 카테고리를 사용하는 거래 수 확인
      const result = await window.electronAPI.db.get(
        'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
        [editingCategory.id]
      ) as { count: number }
      setTransactionCount(result.count)

      // 대체 가능한 카테고리 목록 조회 (같은 타입의 카테고리만)
      if (result.count > 0) {
        const categories = await window.electronAPI.db.query(
          'SELECT * FROM categories WHERE is_active = 1 AND id != ? AND type = ? ORDER BY expense_type, sort_order',
          [editingCategory.id, editingCategory.type]
        ) as Category[]
        setAvailableCategories(categories)
        setReplacementCategoryId('')
      }

      setDeleteDialogOpen(true)
    } catch (error) {
      console.error('Failed to check transactions:', error)
      alert('삭제 확인 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async () => {
    if (!editingCategory) return

    // 연결된 거래가 있으면 대체 카테고리 필수
    if (transactionCount > 0 && !replacementCategoryId) {
      alert('대체 카테고리를 선택해주세요.')
      return
    }

    try {
      // 연결된 거래가 있으면 대체 카테고리로 변경
      if (transactionCount > 0 && replacementCategoryId) {
        await window.electronAPI.db.query(
          'UPDATE transactions SET category_id = ? WHERE category_id = ?',
          [replacementCategoryId, editingCategory.id]
        )
      }

      // 예산 항목 연결 삭제
      await window.electronAPI.db.query(
        'DELETE FROM budget_item_categories WHERE category_id = ?',
        [editingCategory.id]
      )
      // 카테고리 삭제
      await window.electronAPI.db.query(
        'DELETE FROM categories WHERE id = ?',
        [editingCategory.id]
      )

      setDeleteDialogOpen(false)
      onSaved()
      handleClose()
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('카테고리 삭제에 실패했습니다.')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEditing ? '카테고리 수정' : '카테고리 추가'}
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="카테고리 이름"
            placeholder="예: 식비"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
            autoFocus
          />

          <FormControl>
            <FormLabel>유형</FormLabel>
            <RadioGroup
              row
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              {typeOptions.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" />}
                  label={opt.label}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {formData.type === 'expense' && (
            <FormControl>
              <FormLabel>지출 유형</FormLabel>
              <RadioGroup
                row
                value={formData.expense_type}
                onChange={(e) => handleChange('expense_type', e.target.value)}
              >
                {expenseTypeOptions.map((opt) => (
                  <FormControlLabel
                    key={opt.value}
                    value={opt.value}
                    control={<Radio size="small" />}
                    label={opt.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          )}

          <FormControl>
            <FormLabel>색상</FormLabel>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {colorOptions.map((color) => (
                <Box
                  key={color}
                  onClick={() => handleChange('color', color)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: color,
                    cursor: 'pointer',
                    border: formData.color === color ? '3px solid' : '2px solid transparent',
                    borderColor: formData.color === color ? 'primary.main' : 'transparent',
                    '&:hover': {
                      transform: 'scale(1.1)',
                    },
                    transition: 'transform 0.2s, border 0.2s',
                  }}
                />
              ))}
            </Box>
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, justifyContent: isEditing ? 'space-between' : 'flex-end' }}>
        {isEditing && (
          <Button onClick={handleDeleteClick} color="error">
            삭제
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Stack>
      </DialogActions>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>카테고리 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: transactionCount > 0 ? 2 : 0 }}>
            <strong>{editingCategory?.name}</strong> 카테고리를 삭제하시겠습니까?
          </Typography>
          {transactionCount > 0 && (
            <Stack spacing={2}>
              <Typography color="warning.main" variant="body2">
                이 카테고리를 사용하는 거래가 {transactionCount}건 있습니다.
                대체할 카테고리를 선택해주세요.
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>대체 카테고리</InputLabel>
                <Select
                  value={replacementCategoryId}
                  label="대체 카테고리"
                  onChange={(e) => setReplacementCategoryId(e.target.value)}
                >
                  {availableCategories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.expense_type === 'fixed' ? '고정비' : '변동비'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            취소
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={transactionCount > 0 && !replacementCategoryId}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
