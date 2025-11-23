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
} from '@mui/material'
import { IconX } from '@tabler/icons-react'
import { v4 as uuidv4 } from 'uuid'
import AmountInput from '../shared/AmountInput'

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

  // AmountInput에서 잔고 변경 처리 (통화는 계좌에서 결정되므로 무시)
  const handleBalanceChange = (amount: string) => {
    setBalance(amount)
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
          <AmountInput
            label="잔고"
            value={balance}
            currency={currency}
            onChange={(amount) => handleBalanceChange(amount)}
            autoFocus
            sx={{ width: '100%' }}
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
