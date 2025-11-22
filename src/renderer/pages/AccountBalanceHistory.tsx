import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
} from '@mui/material'
import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import BalanceModal from '../components/modals/BalanceModal'
import AmountText from '../components/shared/AmountText'

interface Account {
  id: string
  name: string
  owner: string
  type: string
  bank_name: string
  account_number: string | null
  currency: string
}

interface BalanceRecord {
  id: string
  account_id: string
  balance: number
  recorded_at: string
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

export default function AccountBalanceHistory() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { setPageTitle, setOnAdd } = usePageContext()
  const [account, setAccount] = useState<Account | null>(null)
  const [balances, setBalances] = useState<BalanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setOnAdd])

  useEffect(() => {
    if (accountId) {
      loadData()
    }
  }, [accountId])

  const loadData = async () => {
    try {
      const [accountResult, balancesResult] = await Promise.all([
        window.electronAPI.db.get(
          'SELECT * FROM accounts WHERE id = ?',
          [accountId]
        ),
        window.electronAPI.db.query(
          'SELECT * FROM account_balances WHERE account_id = ? ORDER BY recorded_at DESC',
          [accountId]
        ),
      ])
      const acc = accountResult as Account
      setAccount(acc)
      setBalances(balancesResult as BalanceRecord[])
      if (acc) {
        setPageTitle(acc.name)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (balanceId: string) => {
    if (!confirm('이 잔고 기록을 삭제하시겠습니까?')) return

    try {
      await window.electronAPI.db.query(
        'DELETE FROM account_balances WHERE id = ?',
        [balanceId]
      )
      loadData()
    } catch (error) {
      console.error('Failed to delete balance:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  if (!account) {
    return (
      <Box>
        <Typography>계좌를 찾을 수 없습니다.</Typography>
        <Button onClick={() => navigate('/accounts')} sx={{ mt: 2 }}>
          계좌 목록으로 돌아가기
        </Button>
      </Box>
    )
  }

  const latestBalance = balances.length > 0 ? balances[0].balance : 0

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate('/accounts')}>
          <IconArrowLeft />
        </IconButton>
        <Stack direction="row" spacing={1} alignItems="center">
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
          {ownerLabels[account.owner]} · {account.bank_name}
          {account.account_number && ` · ${account.account_number}`}
        </Typography>
      </Stack>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            현재 잔고
          </Typography>
          <AmountText
            amount={latestBalance}
            currency={account.currency}
            variant="h3"
            fontWeight={600}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>
            잔고 히스토리
          </Typography>
          {balances.length === 0 ? (
            <Typography color="textSecondary" textAlign="center" py={4}>
              기록된 잔고가 없습니다.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>기록일시</TableCell>
                    <TableCell align="right">잔고</TableCell>
                    <TableCell align="right">변동</TableCell>
                    <TableCell align="center" width={60}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balances.map((record, index) => {
                    const prevBalance = balances[index + 1]?.balance ?? record.balance
                    const diff = record.balance - prevBalance
                    return (
                      <TableRow key={record.id} hover>
                        <TableCell>{formatDate(record.recorded_at)}</TableCell>
                        <TableCell align="right">
                          <AmountText
                            amount={record.balance}
                            currency={account.currency}
                            fontWeight={500}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {index < balances.length - 1 && (
                            <AmountText
                              amount={diff}
                              currency={account.currency}
                              fontWeight={500}
                              color={diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'textSecondary'}
                              showSign
                              signType="auto"
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(record.id)}
                            color="error"
                          >
                            <IconTrash size={16} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <BalanceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
        accountId={accountId!}
        currency={account.currency}
      />
    </Box>
  )
}
