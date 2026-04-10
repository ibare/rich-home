import { RefObject } from 'react'
import {
  TextField,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
  Box,
  Autocomplete,
  FormControlLabel,
  Switch,
  Button,
} from '@mui/material'
import { IconPlus } from '@tabler/icons-react'
import AmountInput from '../shared/AmountInput'
import CategoryPicker from '../shared/CategoryPicker'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  expense_type: string | null
}

interface FormData {
  type: 'income' | 'expense'
  amount: string
  currency: string
  category_id: string
  date: string
  description: string
  include_in_stats: boolean
  tags: string[]
}

interface TransactionFormProps {
  formData: FormData
  categories: Category[]
  descriptionSuggestions: string[]
  tagSuggestions: string[]
  isEditMode: boolean
  saving: boolean
  amountRef: RefObject<HTMLInputElement | null>
  categoryAnchorEl: HTMLElement | null
  onCategoryAnchorChange: (el: HTMLElement | null) => void
  onChange: (field: string, value: string) => void
  onAmountChange: (amount: string, currency: string) => void
  onFormDataChange: (updater: (prev: FormData) => FormData) => void
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export default function TransactionForm({
  formData,
  categories,
  descriptionSuggestions,
  tagSuggestions,
  isEditMode,
  saving,
  amountRef,
  categoryAnchorEl,
  onCategoryAnchorChange,
  onChange,
  onAmountChange,
  onFormDataChange,
  onSubmit,
  onKeyDown,
}: TransactionFormProps) {
  return (
    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, mb: 2 }}>
      <Stack spacing={2}>
        {/* 첫 번째 줄: 날짜, 수입/지출, 통계 포함 */}
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            type="date"
            value={formData.date}
            onChange={(e) => onChange('date', e.target.value)}
            size="small"
            sx={{ width: 160 }}
          />

          <ToggleButtonGroup
            value={formData.type}
            exclusive
            onChange={(_, value) => value && onChange('type', value)}
            size="small"
          >
            <ToggleButton value="expense" color="error" sx={{ px: 2 }}>
              지출
            </ToggleButton>
            <ToggleButton value="income" color="success" sx={{ px: 2 }}>
              수입
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1 }} />

          <FormControlLabel
            control={
              <Switch
                checked={formData.include_in_stats}
                onChange={(e) => onFormDataChange(prev => ({ ...prev, include_in_stats: e.target.checked }))}
                size="small"
              />
            }
            label="통계 포함"
            sx={{ mr: 0 }}
          />
        </Stack>

        {/* 두 번째 줄: 카테고리, 금액, 내용, 추가 버튼 */}
        <Stack direction="row" spacing={2} onKeyDown={onKeyDown}>
          <Chip
            label={(() => {
              const selected = categories.find(c => c.id === formData.category_id)
              return selected ? selected.name : '카테고리'
            })()}
            variant={formData.category_id ? 'filled' : 'outlined'}
            color={formData.category_id ? 'primary' : 'default'}
            onClick={(e) => onCategoryAnchorChange(e.currentTarget)}
            sx={{ cursor: 'pointer', height: 40, fontSize: '0.875rem', px: 1 }}
          />
          <CategoryPicker
            anchorEl={categoryAnchorEl}
            onClose={() => onCategoryAnchorChange(null)}
            transactionType={formData.type}
            selectedCategoryId={formData.category_id}
            onSelect={(id) => onChange('category_id', id)}
          />

          <AmountInput
            inputRef={amountRef}
            value={formData.amount}
            currency={formData.currency}
            onChange={onAmountChange}
            autoFocus
          />

          <Autocomplete
            freeSolo
            options={descriptionSuggestions}
            value={formData.description}
            onChange={(_, newValue) => onChange('description', newValue || '')}
            onInputChange={(_, newInputValue) => onChange('description', newInputValue)}
            disabled={!formData.category_id}
            sx={{ flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="내용 (선택)"
                size="small"
                placeholder={formData.category_id ? "예: 이마트 장보기" : "카테고리를 먼저 선택하세요"}
              />
            )}
          />

          <Button
            variant="contained"
            onClick={onSubmit}
            startIcon={isEditMode ? null : <IconPlus size={18} />}
            sx={{ minWidth: 100 }}
            disabled={saving}
          >
            {isEditMode ? (saving ? '저장 중...' : '저장') : '추가'}
          </Button>
        </Stack>

        {/* 세 번째 줄: 태그 */}
        <Stack direction="row" spacing={2}>
          <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={tagSuggestions}
            value={formData.tags}
            onChange={(_, newValue) => onFormDataChange(prev => ({ ...prev, tags: newValue as string[] }))}
            sx={{ flex: 1 }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={option}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="태그 (선택)"
                size="small"
                placeholder="태그 입력 후 Enter"
              />
            )}
          />
        </Stack>

        {!isEditMode && (
          <Typography variant="caption" color="textSecondary">
            Enter 키를 눌러 빠르게 추가할 수 있습니다.
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
