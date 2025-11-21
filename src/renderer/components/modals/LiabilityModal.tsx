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
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface LiabilityModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const typeOptions = [
  { value: 'mortgage', label: '주택담보대출' },
  { value: 'credit_loan', label: '신용대출' },
  { value: 'jeonse_deposit', label: '전세보증금 (받은 것)' },
  { value: 'car_loan', label: '자동차대출' },
  { value: 'other', label: '기타' },
]

const currencyOptions = [
  { value: 'KRW', label: 'KRW' },
  { value: 'AED', label: 'AED' },
]

export default function LiabilityModal({ open, onClose, onSaved }: LiabilityModalProps) {
  const [formData, setFormData] = useState({
    type: 'mortgage',
    name: '',
    principal_amount: '',
    current_balance: '',
    interest_rate: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
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
        principal_amount: prev.principal_amount ? formatNumber(prev.principal_amount.replace(/,/g, ''), value) : '',
        current_balance: prev.current_balance ? formatNumber(prev.current_balance.replace(/,/g, ''), value) : '',
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  const handleAmountChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '.' || !isNaN(parseFloat(raw)) || (raw.endsWith('.') && formData.currency === 'AED')) {
      setFormData((prev) => ({ ...prev, [field]: formatNumber(raw, prev.currency) }))
    }
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('부채명을 입력해주세요.')
      return
    }

    const principalAmount = parseFloat(formData.principal_amount.replace(/,/g, ''))
    if (isNaN(principalAmount) || principalAmount <= 0) {
      alert('원금을 입력해주세요.')
      return
    }

    const currentBalance = formData.current_balance
      ? parseFloat(formData.current_balance.replace(/,/g, ''))
      : principalAmount

    if (isNaN(currentBalance) || currentBalance < 0) {
      alert('올바른 현재 잔액을 입력해주세요.')
      return
    }

    const interestRate = formData.interest_rate
      ? parseFloat(formData.interest_rate)
      : null

    setSaving(true)
    try {
      await window.electronAPI.db.query(
        `INSERT INTO liabilities (id, name, type, principal_amount, current_balance, interest_rate, start_date, end_date, currency, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          formData.name,
          formData.type,
          principalAmount,
          currentBalance,
          interestRate,
          formData.start_date,
          formData.end_date || null,
          formData.currency,
          formData.memo || null,
        ]
      )

      resetForm()
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save liability:', error)
      alert('부채 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'mortgage',
      name: '',
      principal_amount: '',
      current_balance: '',
      interest_rate: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
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
        부채 등록
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>부채 유형</InputLabel>
            <Select
              value={formData.type}
              label="부채 유형"
              onChange={(e) => handleChange('type', e.target.value)}
            >
              {typeOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="부채명"
            placeholder="예: 신한은행 주택담보대출"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="원금"
            value={formData.principal_amount}
            onChange={(e) => handleAmountChange('principal_amount', e)}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ),
            }}
            placeholder="0"
          />

          <TextField
            label="현재 잔액 (비워두면 원금과 동일)"
            value={formData.current_balance}
            onChange={(e) => handleAmountChange('current_balance', e)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ),
            }}
            placeholder="0"
          />

          <TextField
            label="이자율 (%)"
            type="number"
            value={formData.interest_rate}
            onChange={(e) => handleChange('interest_rate', e.target.value)}
            fullWidth
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            placeholder="예: 3.5"
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="시작일"
              type="date"
              value={formData.start_date}
              onChange={(e) => handleChange('start_date', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="만기일 (선택)"
              type="date"
              value={formData.end_date}
              onChange={(e) => handleChange('end_date', e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

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
            placeholder="예: 변동금리, 매월 15일 상환"
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
