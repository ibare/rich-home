import { useState, useEffect, useRef } from 'react'
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
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  Divider,
  Autocomplete,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { IconX, IconPlus, IconTrash } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'

interface EditTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_id: string
  date: string
  description: string | null
  include_in_stats: number
  tag: string | null
}

interface TransactionModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  selectedYear?: number
  selectedMonth?: number
  editTransaction?: EditTransaction | null
}

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  expense_type: string | null
}

interface PendingTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_id: string
  category_name: string
  date: string
  description: string
  include_in_stats: boolean
  tags: string[]
}

// 해당 월의 마지막 날 계산
const getLastDayOfMonth = (year: number, month: number) => {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export default function TransactionModal({ open, onClose, onSaved, selectedYear, selectedMonth, editTransaction }: TransactionModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingList, setPendingList] = useState<PendingTransaction[]>([])
  const isEditMode = !!editTransaction

  // 초기 날짜: 선택된 년월의 마지막 날 또는 오늘
  const getInitialDate = () => {
    if (selectedYear && selectedMonth) {
      return getLastDayOfMonth(selectedYear, selectedMonth)
    }
    return new Date().toISOString().slice(0, 10)
  }

  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    currency: 'KRW',
    category_id: '',
    date: getInitialDate(),
    description: '',
    include_in_stats: true,
    tags: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      loadCategories()
      loadTagSuggestions()
      if (editTransaction) {
        // 수정 모드: 기존 데이터로 폼 채우기
        const existingTags = editTransaction.tag
          ? editTransaction.tag.split(',').map(t => t.trim()).filter(t => t)
          : []
        setFormData({
          type: editTransaction.type,
          amount: editTransaction.amount.toLocaleString(),
          currency: editTransaction.currency,
          category_id: editTransaction.category_id,
          date: editTransaction.date,
          description: editTransaction.description || '',
          include_in_stats: editTransaction.include_in_stats === 1,
          tags: existingTags,
        })
        loadDescriptionSuggestions(editTransaction.category_id)
      } else if (selectedYear && selectedMonth) {
        // 추가 모드: 선택된 년월의 마지막 날로 날짜 설정
        setFormData((prev) => ({
          ...prev,
          date: getLastDayOfMonth(selectedYear, selectedMonth),
        }))
      }
    }
  }, [open, selectedYear, selectedMonth, editTransaction])

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.db.query(
        'SELECT * FROM categories WHERE is_active = 1 ORDER BY type, expense_type, sort_order'
      )
      setCategories(result as Category[])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  // 카테고리별 이전 입력 내용 조회
  const loadDescriptionSuggestions = async (categoryId: string) => {
    if (!categoryId) {
      setDescriptionSuggestions([])
      return
    }

    try {
      const result = await window.electronAPI.db.query(
        `SELECT DISTINCT description FROM transactions
         WHERE category_id = ? AND description IS NOT NULL AND description != ''
         ORDER BY created_at DESC
         LIMIT 20`,
        [categoryId]
      ) as { description: string }[]

      setDescriptionSuggestions(result.map((r) => r.description))
    } catch (error) {
      console.error('Failed to load description suggestions:', error)
      setDescriptionSuggestions([])
    }
  }

  // 기존 거래에서 태그 목록 조회 (그룹핑)
  const loadTagSuggestions = async () => {
    try {
      const result = await window.electronAPI.db.query(
        `SELECT DISTINCT tag FROM transactions
         WHERE tag IS NOT NULL AND tag != ''`
      ) as { tag: string }[]

      // 컴마로 구분된 태그들을 분리하고 중복 제거
      const allTags = new Set<string>()
      result.forEach(r => {
        r.tag.split(',').forEach(t => {
          const trimmed = t.trim()
          if (trimmed) allTags.add(trimmed)
        })
      })

      setTagSuggestions(Array.from(allTags).sort())
    } catch (error) {
      console.error('Failed to load tag suggestions:', error)
      setTagSuggestions([])
    }
  }

  const handleChange = (field: string, value: string) => {
    if (field === 'type') {
      setFormData((prev) => ({ ...prev, type: value as 'income' | 'expense', category_id: '' }))
      setDescriptionSuggestions([])
    } else if (field === 'category_id') {
      setFormData((prev) => ({ ...prev, [field]: value }))
      loadDescriptionSuggestions(value)
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  // AmountInput에서 금액과 통화 변경 처리
  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, amount, currency }))
  }

  // 목록에 추가 (아직 저장 X)
  const handleAddToList = () => {
    const amount = parseFloat(formData.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      alert('금액을 입력해주세요.')
      return
    }

    if (!formData.category_id) {
      alert('카테고리를 선택해주세요.')
      return
    }

    const category = categories.find((c) => c.id === formData.category_id)

    const newTransaction: PendingTransaction = {
      id: uuidv4(),
      type: formData.type,
      amount,
      currency: formData.currency,
      category_id: formData.category_id,
      category_name: category?.name || '',
      date: formData.date,
      description: formData.description,
      include_in_stats: formData.include_in_stats,
      tags: formData.tags,
    }
    setPendingList((prev) => [...prev, newTransaction])

    // 금액과 내용만 초기화 (날짜, 타입, 통화, 카테고리, 태그 유지)
    setFormData((prev) => ({
      ...prev,
      amount: '',
      description: '',
    }))

    // 금액 입력 필드에 포커스
    setTimeout(() => {
      amountRef.current?.focus()
    }, 100)
  }

  // 목록에서 삭제
  const handleRemoveFromList = (id: string) => {
    setPendingList((prev) => prev.filter((t) => t.id !== id))
  }

  // 수정 저장
  const handleUpdate = async () => {
    if (!editTransaction) return

    const amount = parseFloat(formData.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      alert('금액을 입력해주세요.')
      return
    }

    if (!formData.category_id) {
      alert('카테고리를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      const tagString = formData.tags.length > 0 ? formData.tags.join(', ') : null
      await window.electronAPI.db.query(
        `UPDATE transactions
         SET type = ?, amount = ?, currency = ?, category_id = ?, date = ?, description = ?, include_in_stats = ?, tag = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          formData.type,
          amount,
          formData.currency,
          formData.category_id,
          formData.date,
          formData.description || null,
          formData.include_in_stats ? 1 : 0,
          tagString,
          editTransaction.id,
        ]
      )

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to update transaction:', error)
      alert('거래 수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 전체 저장
  const handleSaveAll = async () => {
    if (pendingList.length === 0) {
      alert('저장할 거래가 없습니다.')
      return
    }

    setSaving(true)
    try {
      for (const tx of pendingList) {
        const tagString = tx.tags.length > 0 ? tx.tags.join(', ') : null
        await window.electronAPI.db.query(
          `INSERT INTO transactions (id, type, amount, currency, category_id, date, description, include_in_stats, tag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tx.id, tx.type, tx.amount, tx.currency, tx.category_id, tx.date, tx.description || null, tx.include_in_stats ? 1 : 0, tagString]
        )
      }

      setPendingList([])
      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save transactions:', error)
      alert('거래 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      currency: 'KRW',
      category_id: '',
      date: new Date().toISOString().slice(0, 10),
      description: '',
      include_in_stats: true,
      tags: [],
    })
  }

  const handleClose = () => {
    if (pendingList.length > 0) {
      if (!confirm('저장하지 않은 거래가 있습니다. 닫으시겠습니까?')) {
        return
      }
    }
    setPendingList([])
    resetForm()
    onClose()
  }

  // Enter 키로 추가/저장
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isEditMode) {
        handleUpdate()
      } else {
        handleAddToList()
      }
    }
  }

  // 현재 타입에 맞는 카테고리 필터링
  const filteredCategories = categories.filter((c) => c.type === formData.type)
  const fixedCategories = filteredCategories.filter((c) => c.expense_type === 'fixed')
  const variableCategories = filteredCategories.filter((c) => c.expense_type === 'variable')
  const incomeCategories = filteredCategories.filter((c) => c.type === 'income')

  const totalExpense = pendingList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = pendingList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEditMode ? '거래 수정' : '거래 등록'}
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* 입력 폼 */}
        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, mb: 2 }}>
          <Stack spacing={2}>
            {/* 첫 번째 줄: 날짜, 수입/지출, 통계 포함 */}
            <Stack direction="row" spacing={2} alignItems="center">
              {/* 날짜 */}
              <TextField
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                size="small"
                sx={{ width: 160 }}
              />

              {/* 수입/지출 */}
              <ToggleButtonGroup
                value={formData.type}
                exclusive
                onChange={(_, value) => value && handleChange('type', value)}
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

              {/* 통계 포함 여부 */}
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.include_in_stats}
                    onChange={(e) => setFormData(prev => ({ ...prev, include_in_stats: e.target.checked }))}
                    size="small"
                  />
                }
                label="통계 포함"
                sx={{ mr: 0 }}
              />
            </Stack>

            {/* 두 번째 줄: 통화, 카테고리, 금액, 내용, 추가 버튼 */}
            <Stack direction="row" spacing={2} onKeyDown={handleKeyDown}>
              {/* 카테고리 */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>카테고리</InputLabel>
                <Select
                  value={formData.category_id}
                  label="카테고리"
                  onChange={(e) => handleChange('category_id', e.target.value)}
                >
                  {formData.type === 'expense' && fixedCategories.length > 0 && (
                    <MenuItem disabled sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      — 고정비 —
                    </MenuItem>
                  )}
                  {formData.type === 'expense' &&
                    fixedCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  {formData.type === 'expense' && variableCategories.length > 0 && (
                    <MenuItem disabled sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      — 변동비 —
                    </MenuItem>
                  )}
                  {formData.type === 'expense' &&
                    variableCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  {formData.type === 'income' &&
                    incomeCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* 금액 */}
              <AmountInput
                inputRef={amountRef}
                value={formData.amount}
                currency={formData.currency}
                onChange={handleAmountChange}
                autoFocus
              />

              {/* 내용 */}
              <Autocomplete
                freeSolo
                options={descriptionSuggestions}
                value={formData.description}
                onChange={(_, newValue) => handleChange('description', newValue || '')}
                onInputChange={(_, newInputValue) => handleChange('description', newInputValue)}
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

              {/* 추가/저장 버튼 */}
              <Button
                variant="contained"
                onClick={isEditMode ? handleUpdate : handleAddToList}
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
                onChange={(_, newValue) => setFormData(prev => ({ ...prev, tags: newValue as string[] }))}
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

        {!isEditMode && (
          <>
            <Divider sx={{ my: 2 }} />

            {/* 추가된 거래 목록 */}
            <Typography variant="subtitle2" gutterBottom>
              추가된 거래 ({pendingList.length}건)
            </Typography>

            {pendingList.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="textSecondary">
                  위 폼에서 거래를 추가하세요.
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ maxHeight: 300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>유형</TableCell>
                        <TableCell>날짜</TableCell>
                        <TableCell>카테고리</TableCell>
                        <TableCell>내용</TableCell>
                        <TableCell align="right">금액</TableCell>
                        <TableCell width={40}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingList.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>
                            <Chip
                              label={tx.type === 'expense' ? '지출' : '수입'}
                              size="small"
                              color={tx.type === 'expense' ? 'error' : 'success'}
                            />
                          </TableCell>
                          <TableCell>{tx.date}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2">{tx.category_name}</Typography>
                              {tx.tags.map((tag, index) => (
                                <Chip
                                  key={index}
                                  label={tag}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.7rem',
                                    bgcolor: 'grey.100',
                                    color: 'grey.600',
                                    border: '1px solid',
                                    borderColor: 'grey.300',
                                    '& .MuiChip-label': { px: 0.75 },
                                  }}
                                />
                              ))}
                            </Stack>
                          </TableCell>
                          <TableCell>{tx.description || '-'}</TableCell>
                          <TableCell align="right">
                            <Typography
                              fontWeight={500}
                              color={tx.type === 'expense' ? 'error.main' : 'success.main'}
                            >
                              {tx.type === 'expense' ? '-' : '+'}
                              {tx.currency} {tx.amount.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveFromList(tx.id)}
                              color="error"
                            >
                              <IconTrash size={16} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 합계 */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="flex-end" spacing={4}>
                    {totalIncome > 0 && (
                      <Typography color="success.main" fontWeight={600}>
                        수입: +KRW {totalIncome.toLocaleString()}
                      </Typography>
                    )}
                    {totalExpense > 0 && (
                      <Typography color="error.main" fontWeight={600}>
                        지출: -KRW {totalExpense.toLocaleString()}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      {!isEditMode && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} color="inherit">
            취소
          </Button>
          <Button
            onClick={handleSaveAll}
            variant="contained"
            disabled={saving || pendingList.length === 0}
          >
            {saving ? '저장 중...' : `${pendingList.length}건 저장`}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
