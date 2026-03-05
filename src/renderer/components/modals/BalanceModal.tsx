import { useState, useEffect } from 'react'
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

interface EditBalanceItem {
  id: string
  balance: number
  recorded_at: string
  memo: string | null
}

interface BalanceModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  accountId: string
  currency: string
  editItem?: EditBalanceItem | null
}

export default function BalanceModal({
  open,
  onClose,
  onSaved,
  accountId,
  currency,
  editItem,
}: BalanceModalProps) {
  const [balance, setBalance] = useState('')
  const [recordedAt, setRecordedAt] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && editItem) {
      setBalance(String(editItem.balance))
      // recorded_at: '2026-02-11 07:43:00' → '2026-02-11T07:43'
      const dt = new Date(editItem.recorded_at)
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16)
      setRecordedAt(local)
    } else if (open) {
      setBalance('')
      setRecordedAt(new Date().toISOString().slice(0, 16))
    }
  }, [open, editItem])

  const handleSubmit = async () => {
    const balanceNum = parseFloat(balance.replace(/,/g, ''))
    if (isNaN(balanceNum)) {
      alert('잔고를 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      if (editItem) {
        await window.electronAPI.db.query(
          `UPDATE account_balances SET balance = ?, recorded_at = ? WHERE id = ?`,
          [balanceNum, recordedAt.replace('T', ' ') + ':00', editItem.id]
        )
      } else {
        await window.electronAPI.db.query(
          `INSERT INTO account_balances (id, account_id, balance, recorded_at)
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), accountId, balanceNum, recordedAt.replace('T', ' ') + ':00']
        )
      }

      onSaved()
      onClose()
    } catch (error) {
      console.error('Failed to save balance:', error)
      alert('잔고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        {editItem ? '잔고 수정' : '잔고 추가'}
        <IconButton size="small" onClick={onClose}>
          <IconX size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <AmountInput
            label="잔고"
            value={balance}
            currency={currency}
            onChange={(amount) => setBalance(amount)}
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
        <Button onClick={onClose} color="inherit">
          취소
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? '저장 중...' : editItem ? '수정' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
