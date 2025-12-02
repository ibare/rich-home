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
  Stack,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
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
    onClose()
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
