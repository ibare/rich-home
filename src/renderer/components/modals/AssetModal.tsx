import { useState } from 'react'
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
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'

interface AssetModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const typeOptions = [
  { value: 'real_estate', label: '부동산' },
  { value: 'stock', label: '주식' },
]

export default function AssetModal({ open, onClose, onSaved }: AssetModalProps) {
  const [formData, setFormData] = useState({
    type: 'real_estate',
    name: '',
    purchase_amount: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    quantity: '1',
    currency: 'KRW',
    memo: '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // AmountInput에서 금액과 통화 변경 처리
  const handleAmountChange = (amount: string, currency: string) => {
    setFormData((prev) => ({ ...prev, purchase_amount: amount, currency }))
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('자산명을 입력해주세요.')
      return
    }

    const amount = parseFloat(formData.purchase_amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      alert('취득 금액을 입력해주세요.')
      return
    }

    const quantity = parseFloat(formData.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      alert('수량을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.db.query(
        `INSERT INTO assets (id, name, type, purchase_amount, purchase_date, quantity, currency, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          formData.name,
          formData.type,
          amount,
          formData.purchase_date,
          quantity,
          formData.currency,
          formData.memo || null,
        ]
      )

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save asset:', error)
      alert('자산 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'real_estate',
      name: '',
      purchase_amount: '',
      purchase_date: new Date().toISOString().slice(0, 10),
      quantity: '1',
      currency: 'KRW',
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
        자산 등록
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl>
            <FormLabel>자산 유형</FormLabel>
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

          <TextField
            label="자산명"
            placeholder={formData.type === 'real_estate' ? '예: 강남 아파트' : '예: 삼성전자'}
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
          />

          <AmountInput
            label={formData.type === 'real_estate' ? '취득 금액' : '매수 단가'}
            value={formData.purchase_amount}
            currency={formData.currency}
            onChange={handleAmountChange}
            sx={{ width: '100%' }}
          />

          {formData.type === 'stock' && (
            <TextField
              label="수량 (주)"
              type="number"
              value={formData.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: 1 }}
            />
          )}

          <TextField
            label={formData.type === 'real_estate' ? '취득일' : '매수일'}
            type="date"
            value={formData.purchase_date}
            onChange={(e) => handleChange('purchase_date', e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            label="메모"
            placeholder="예: 전세 보증금 포함"
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
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
