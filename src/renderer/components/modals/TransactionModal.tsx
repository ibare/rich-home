import { useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import { useToast } from '../../contexts/ToastContext'
import { getAllActiveCategories } from '../../repositories/categoryRepository'
import { getDescriptionSuggestions, getTagSuggestions, updateTransaction, createTransaction } from '../../repositories/transactionRepository'
import TransactionForm from './TransactionForm'
import PendingTransactionList from './PendingTransactionList'

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

const getLastDayOfMonth = (year: number, month: number) => {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export default function TransactionModal({ open, onClose, onSaved, selectedYear, selectedMonth, editTransaction }: TransactionModalProps) {
  const { showWarning, showError } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingList, setPendingList] = useState<PendingTransaction[]>([])
  const isEditMode = !!editTransaction

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
  const [categoryAnchorEl, setCategoryAnchorEl] = useState<HTMLElement | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      loadCategories()
      loadTagSuggestionsData()
      if (editTransaction) {
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
        setFormData((prev) => ({
          ...prev,
          date: getLastDayOfMonth(selectedYear, selectedMonth),
        }))
      }
    }
  }, [open, selectedYear, selectedMonth, editTransaction])

  const loadCategories = async () => {
    try {
      const result = await getAllActiveCategories()
      setCategories(result as Category[])
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadDescriptionSuggestions = async (categoryId: string) => {
    if (!categoryId) {
      setDescriptionSuggestions([])
      return
    }
    try {
      setDescriptionSuggestions(await getDescriptionSuggestions(categoryId))
    } catch (error) {
      console.error('Failed to load description suggestions:', error)
      setDescriptionSuggestions([])
    }
  }

  const loadTagSuggestionsData = async () => {
    try {
      setTagSuggestions(await getTagSuggestions())
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

  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, amount, currency }))
  }

  const handleAddToList = () => {
    const amount = parseFloat(formData.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showWarning('금액을 입력해주세요.')
      return
    }
    if (!formData.category_id) {
      showWarning('카테고리를 선택해주세요.')
      return
    }

    const category = categories.find((c) => c.id === formData.category_id)
    setPendingList((prev) => [...prev, {
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
    }])

    setFormData((prev) => ({ ...prev, amount: '', description: '' }))
    setTimeout(() => { amountRef.current?.focus() }, 100)
  }

  const handleUpdate = async () => {
    if (!editTransaction) return
    const amount = parseFloat(formData.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      showWarning('금액을 입력해주세요.')
      return
    }
    if (!formData.category_id) {
      showWarning('카테고리를 선택해주세요.')
      return
    }

    setSaving(true)
    try {
      await updateTransaction(editTransaction.id, {
        type: formData.type,
        amount,
        currency: formData.currency,
        category_id: formData.category_id,
        date: formData.date,
        description: formData.description || null,
        include_in_stats: formData.include_in_stats ? 1 : 0,
        tag: formData.tags.length > 0 ? formData.tags.join(', ') : null,
      })
      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to update transaction:', error)
      showError('거래 수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    if (pendingList.length === 0) {
      showWarning('저장할 거래가 없습니다.')
      return
    }
    setSaving(true)
    try {
      for (const tx of pendingList) {
        await createTransaction({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          category_id: tx.category_id,
          date: tx.date,
          description: tx.description || null,
          include_in_stats: tx.include_in_stats ? 1 : 0,
          tag: tx.tags.length > 0 ? tx.tags.join(', ') : null,
        })
      }
      setPendingList([])
      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save transactions:', error)
      showError('거래 저장에 실패했습니다.')
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
      if (!confirm('저장하지 않은 거래가 있습니다. 닫으시겠습니까?')) return
    }
    setPendingList([])
    resetForm()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      isEditMode ? handleUpdate() : handleAddToList()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEditMode ? '거래 수정' : '거래 등록'}
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <TransactionForm
          formData={formData}
          categories={categories}
          descriptionSuggestions={descriptionSuggestions}
          tagSuggestions={tagSuggestions}
          isEditMode={isEditMode}
          saving={saving}
          amountRef={amountRef}
          categoryAnchorEl={categoryAnchorEl}
          onCategoryAnchorChange={setCategoryAnchorEl}
          onChange={handleChange}
          onAmountChange={handleAmountChange}
          onFormDataChange={setFormData}
          onSubmit={isEditMode ? handleUpdate : handleAddToList}
          onKeyDown={handleKeyDown}
        />

        {!isEditMode && (
          <PendingTransactionList
            pendingList={pendingList}
            onRemove={(id) => setPendingList((prev) => prev.filter((t) => t.id !== id))}
          />
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
