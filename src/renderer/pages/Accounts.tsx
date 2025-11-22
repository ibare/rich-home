import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material'
import { IconWallet, IconTrash } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import AccountModal from '../components/modals/AccountModal'
import AmountText from '../components/shared/AmountText'

interface Account {
  id: string
  name: string
  owner: string
  type: string
  bank_name: string
  account_number: string | null
  currency: string
  is_active: number
  latest_balance?: number
}

const ownerLabels: Record<string, string> = {
  self: '김민태',
  spouse: '박전하',
  child: '김진우',
}

const typeLabels: Record<string, string> = {
  checking: '입출금',
  savings: '저축',
  cma: 'CMA',
  regular: '일반',
  other: '기타',
}

export default function Accounts() {
  const navigate = useNavigate()
  const { setPageTitle, setOnAdd } = usePageContext()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null)

  useEffect(() => {
    setPageTitle('계좌 관리')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const result = await window.electronAPI.db.query(`
        SELECT
          a.*,
          (SELECT balance FROM account_balances
           WHERE account_id = a.id
           ORDER BY recorded_at DESC LIMIT 1) as latest_balance
        FROM accounts a
        WHERE a.is_active = 1
        ORDER BY a.owner, a.bank_name
      `)
      setAccounts(result as Account[])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, account: Account) => {
    e.stopPropagation()
    setDeletingAccount(account)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingAccount) return

    try {
      // 잔고 데이터 먼저 삭제
      await window.electronAPI.db.query(
        'DELETE FROM account_balances WHERE account_id = ?',
        [deletingAccount.id]
      )
      // 계좌 삭제
      await window.electronAPI.db.query(
        'DELETE FROM accounts WHERE id = ?',
        [deletingAccount.id]
      )

      setDeleteDialogOpen(false)
      setDeletingAccount(null)
      loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('계좌 삭제에 실패했습니다.')
    }
  }

  const groupedAccounts = accounts.reduce((acc, account) => {
    const owner = account.owner
    if (!acc[owner]) acc[owner] = []
    acc[owner].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {accounts.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary" textAlign="center" py={4}>
              등록된 계좌가 없습니다. 계좌를 추가해보세요.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={3}>
          {Object.entries(groupedAccounts).map(([owner, ownerAccounts]) => (
            <Box key={owner}>
              <Typography variant="h6" fontWeight={600} mb={2}>
                {ownerLabels[owner] || owner}
              </Typography>
              <Stack spacing={2}>
                {ownerAccounts.map((account) => (
                  <Card
                    key={account.id}
                    elevation={2}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                  >
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: 'primary.light',
                              color: 'primary.main',
                            }}
                          >
                            <IconWallet size={24} />
                          </Box>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="h6">{account.name}</Typography>
                              <Chip
                                label={typeLabels[account.type] || account.type}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={account.currency}
                                size="small"
                                color={account.currency === 'KRW' ? 'primary' : 'secondary'}
                              />
                            </Stack>
                            <Typography variant="body2" color="textSecondary">
                              {account.bank_name}
                              {account.account_number && ` · ${account.account_number}`}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          <AmountText
                            amount={account.latest_balance || 0}
                            currency={account.currency}
                            variant="h5"
                            fontWeight={600}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteClick(e, account)}
                            sx={{ color: 'error.main' }}
                          >
                            <IconTrash size={18} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>계좌 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deletingAccount?.name}</strong> 계좌를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            계좌와 함께 모든 잔고 기록이 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            취소
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadAccounts}
      />
    </Box>
  )
}
