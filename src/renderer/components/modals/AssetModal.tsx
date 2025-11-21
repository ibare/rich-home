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
  InputAdornment,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface AssetModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const typeOptions = [
  { value: 'real_estate', label: '부동산' },
  { value: 'stock', label: '주식' },
]

const currencyOptions = [
  { value: 'KRW', label: 'KRW' },
  { value: 'AED', label: 'AED' },
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

  const formatNumber = (value: string, currency: string) => {
    const num = value.replace(/[^\d.]/g, '')
    if (num === '') return ''

    // AED는 소수점 2자리까지 허용
    if (currency === 'AED') {
      const parts = num.split('.')
      if (parts.length > 2) return formatNumber(parts[0] + '.' + parts.slice(1).join(''), currency)
      if (parts[1]?.length > 2) {
        parts[1] = parts[1].slice(0, 2)
      }
      const parsed = parseFloat(parts.join('.'))
      if (isNaN(parsed)) return ''
      if (parts.length === 2) {
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
          .replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
          + (num.endsWith('.') ? '.' : (parts[1] === '' ? '.' : ''))
      }
      return parsed.toLocaleString()
    }

    // KRW는 정수만
    const parsed = parseInt(num.split('.')[0], 10)
    if (isNaN(parsed)) return ''
    return parsed.toLocaleString()
  }

  const handleChange = (field: string, value: string) => {
    if (field === 'currency') {
      // 통화 변경시 금액 재포맷
      setFormData((prev) => ({
        ...prev,
        currency: value,
        purchase_amount: prev.purchase_amount ? formatNumber(prev.purchase_amount.replace(/,/g, ''), value) : '',
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '.' || !isNaN(parseFloat(raw)) || (raw.endsWith('.') && formData.currency === 'AED')) {
      setFormData((prev) => ({ ...prev, purchase_amount: formatNumber(raw, prev.currency) }))
    }
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

          <TextField
            label={formData.type === 'real_estate' ? '취득 금액' : '매수 단가'}
            value={formData.purchase_amount}
            onChange={handleAmountChange}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ),
            }}
            placeholder="0"
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

          <FormControl>
            <FormLabel>통화</FormLabel>
            <RadioGroup
              row
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              {currencyOptions.map((opt) => (
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
