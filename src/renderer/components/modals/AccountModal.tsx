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
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface AccountModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const ownerOptions = [
  { value: 'self', label: '김민태' },
  { value: 'spouse', label: '박전하' },
  { value: 'child', label: '김진우' },
]

const typeOptions = [
  { value: 'checking', label: '입출금' },
  { value: 'savings', label: '저축' },
  { value: 'cma', label: 'CMA' },
  { value: 'regular', label: '일반' },
  { value: 'other', label: '기타' },
]

const currencyOptions = [
  { value: 'KRW', label: 'KRW' },
  { value: 'AED', label: 'AED' },
]

export default function AccountModal({ open, onClose, onSaved }: AccountModalProps) {
  const [formData, setFormData] = useState({
    owner: 'self',
    type: 'checking',
    bank_name: '',
    account_number: '',
    currency: 'KRW',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.bank_name) {
      alert('은행명은 필수입니다.')
      return
    }

    setSaving(true)
    try {
      const id = uuidv4()
      // name은 은행명으로 자동 설정
      await window.electronAPI.db.query(
        `INSERT INTO accounts (id, name, owner, type, bank_name, account_number, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          formData.bank_name,
          formData.owner,
          formData.type,
          formData.bank_name,
          formData.account_number || null,
          formData.currency,
        ]
      )

      // 초기 잔고 0으로 설정
      await window.electronAPI.db.query(
        `INSERT INTO account_balances (id, account_id, balance, recorded_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [uuidv4(), id, 0]
      )

      setFormData({
        owner: 'self',
        type: 'checking',
        bank_name: '',
        account_number: '',
        currency: 'KRW',
      })
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save account:', error)
      alert('계좌 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      owner: 'self',
      type: 'checking',
      bank_name: '',
      account_number: '',
      currency: 'KRW',
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        계좌 추가
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl>
            <FormLabel>소유자</FormLabel>
            <RadioGroup
              row
              value={formData.owner}
              onChange={(e) => handleChange('owner', e.target.value)}
            >
              {ownerOptions.map((opt) => (
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
            label="은행명"
            placeholder="예: 신한은행"
            value={formData.bank_name}
            onChange={(e) => handleChange('bank_name', e.target.value)}
            fullWidth
            required
          />

          <FormControl fullWidth>
            <InputLabel>계좌 종류</InputLabel>
            <Select
              value={formData.type}
              label="계좌 종류"
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
            label="계좌번호"
            placeholder="예: 110-123-456789"
            value={formData.account_number}
            onChange={(e) => handleChange('account_number', e.target.value)}
            fullWidth
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
