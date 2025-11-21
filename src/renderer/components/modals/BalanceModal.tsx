import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  IconButton,
  InputAdornment,
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'

interface BalanceModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  accountId: string
  currency: string
}

export default function BalanceModal({
  open,
  onClose,
  onSaved,
  accountId,
  currency,
}: BalanceModalProps) {
  const [balance, setBalance] = useState('')
  const [recordedAt, setRecordedAt] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    const balanceNum = parseFloat(balance.replace(/,/g, ''))
    if (isNaN(balanceNum)) {
      alert('잔고를 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.db.query(
        `INSERT INTO account_balances (id, account_id, balance, recorded_at)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), accountId, balanceNum, recordedAt.replace('T', ' ') + ':00']
      )

      setBalance('')
      setRecordedAt(new Date().toISOString().slice(0, 16))
      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save balance:', error)
      alert('잔고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setBalance('')
    setRecordedAt(new Date().toISOString().slice(0, 16))
    onClose()
  }

  const formatBalance = (value: string) => {
    // Remove non-numeric characters except minus and decimal point
    const num = value.replace(/[^\d.-]/g, '')
    if (num === '' || num === '-') return num

    // AED는 소수점 2자리까지 허용
    if (currency === 'AED') {
      const parts = num.split('.')
      if (parts.length > 2) return formatBalance(parts[0] + '.' + parts.slice(1).join(''))
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

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '-' || raw === '.' || !isNaN(parseFloat(raw)) || (raw.endsWith('.') && currency === 'AED')) {
      setBalance(formatBalance(raw))
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        잔고 추가
        <IconButton size="small" onClick={handleClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            label="잔고"
            value={balance}
            onChange={handleBalanceChange}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">{currency}</InputAdornment>
              ),
            }}
            placeholder="0"
            autoFocus
          />

          <TextField
            label="기록 일시"
            type="datetime-local"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
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
