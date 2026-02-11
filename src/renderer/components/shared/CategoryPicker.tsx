import { useState, useEffect } from 'react'
import { Box, Chip, Divider, Popover, Tooltip, Typography } from '@mui/material'
import { IconPlus } from '@tabler/icons-react'
import CategoryModal from '../modals/CategoryModal'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  expense_type: string | null
}

interface CategoryPickerProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  transactionType: 'income' | 'expense'
  selectedCategoryId?: string
  selectedCategoryIds?: string[]
  multiSelect?: boolean
  disabledCategoryMap?: Record<string, string>
  onSelect: (categoryId: string) => void
}

export default function CategoryPicker({
  anchorEl,
  onClose,
  transactionType,
  selectedCategoryId,
  selectedCategoryIds = [],
  multiSelect = false,
  disabledCategoryMap = {},
  onSelect,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  useEffect(() => {
    if (anchorEl) {
      loadCategories()
    }
  }, [anchorEl])

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.db.query(
        'SELECT * FROM categories WHERE is_active = 1 ORDER BY type, expense_type, name'
      )
      setCategories(result as Category[])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const filtered = categories.filter((c) => c.type === transactionType)
  const fixedCategories = filtered.filter((c) => c.expense_type === 'fixed')
  const variableCategories = filtered.filter((c) => c.expense_type === 'variable')
  const incomeCategories = filtered.filter((c) => c.type === 'income')

  const isSelected = (catId: string) =>
    multiSelect ? selectedCategoryIds.includes(catId) : selectedCategoryId === catId

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId)
    if (!multiSelect) onClose()
  }

  const stripeBackground = 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)'

  const renderChip = (cat: Category) => {
    const disabled = cat.id in disabledCategoryMap
    const chip = (
      <Chip
        key={cat.id}
        label={cat.name}
        size="small"
        variant={isSelected(cat.id) ? 'filled' : 'outlined'}
        color={isSelected(cat.id) ? 'primary' : disabled ? 'default' : 'default'}
        onClick={disabled ? undefined : () => handleSelect(cat.id)}
        sx={{
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          ...(disabled && {
            background: stripeBackground,
          }),
        }}
      />
    )
    if (disabled) {
      return (
        <Tooltip key={cat.id} title={`${disabledCategoryMap[cat.id]} 예산에서 사용 중`} arrow>
          {chip}
        </Tooltip>
      )
    }
    return chip
  }

  return (
    <>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 400 } } }}
      >
        {transactionType === 'expense' && fixedCategories.length > 0 && (
          <>
            <Typography variant="caption" color="textSecondary" sx={{ mb: 0.5, display: 'block' }}>
              고정비
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {fixedCategories.map(renderChip)}
            </Box>
          </>
        )}
        {transactionType === 'expense' && variableCategories.length > 0 && (
          <>
            <Typography variant="caption" color="textSecondary" sx={{ mb: 0.5, display: 'block' }}>
              변동비
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {variableCategories.map(renderChip)}
            </Box>
          </>
        )}
        {transactionType === 'income' && incomeCategories.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {incomeCategories.map(renderChip)}
          </Box>
        )}
        <Divider sx={{ my: 1.5 }} />
        <Chip
          icon={<IconPlus size={14} />}
          label="카테고리 추가"
          size="small"
          variant="outlined"
          onClick={() => { onClose(); setCategoryModalOpen(true) }}
          sx={{ cursor: 'pointer' }}
        />
      </Popover>
      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSaved={() => { loadCategories(); setCategoryModalOpen(false) }}
      />
    </>
  )
}
