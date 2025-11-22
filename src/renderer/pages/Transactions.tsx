import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material'
import {
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import TransactionModal from '../components/modals/TransactionModal'
import AmountText from '../components/shared/AmountText'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_id: string
  category_name: string
  date: string
  description: string | null
  memo: string | null
}

export default function Transactions() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 필터
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')

  useEffect(() => {
    setPageTitle('거래 내역')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadTransactions()
  }, [selectedYear, selectedMonth, typeFilter])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      let query = `
        SELECT t.*, c.name as category_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.date >= ? AND t.date < ?
      `
      const params: (string | number)[] = [startDate, endDate]

      if (typeFilter !== 'all') {
        query += ' AND t.type = ?'
        params.push(typeFilter)
      }

      query += ' ORDER BY t.date DESC, t.created_at DESC'

      const result = await window.electronAPI.db.query(query, params)
      setTransactions(result as Transaction[])
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await window.electronAPI.db.query('DELETE FROM transactions WHERE id = ?', [deletingId])
      setDeleteConfirmOpen(false)
      setDeletingId(null)
      loadTransactions()
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const navigateMonth = (direction: number) => {
    let newMonth = selectedMonth + direction
    let newYear = selectedYear

    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }

    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
  }

  // 합계 계산
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  // 날짜별 그룹핑
  const groupedTransactions = transactions.reduce(
    (acc, tx) => {
      if (!acc[tx.date]) {
        acc[tx.date] = []
      }
      acc[tx.date].push(tx)
      return acc
    },
    {} as Record<string, Transaction[]>
  )

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* 월 선택 & 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton onClick={() => navigateMonth(-1)}>
                <IconChevronLeft />
              </IconButton>
              <Typography variant="h5" fontWeight={600}>
                {selectedYear}년 {selectedMonth}월
              </Typography>
              <IconButton onClick={() => navigateMonth(1)}>
                <IconChevronRight />
              </IconButton>
            </Stack>

            <ToggleButtonGroup
              value={typeFilter}
              exclusive
              onChange={(_, value) => value && setTypeFilter(value)}
              size="small"
            >
              <ToggleButton value="all">전체</ToggleButton>
              <ToggleButton value="expense" color="error">
                지출
              </ToggleButton>
              <ToggleButton value="income" color="success">
                수입
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      {/* 요약 */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              수입
            </Typography>
            <AmountText
              amount={totalIncome}
              currency="KRW"
              variant="h5"
              fontWeight={600}
              color="success.main"
              showSign
              signType="income"
            />
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              지출
            </Typography>
            <AmountText
              amount={totalExpense}
              currency="KRW"
              variant="h5"
              fontWeight={600}
              color="error.main"
              showSign
              signType="expense"
            />
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              합계
            </Typography>
            <AmountText
              amount={totalIncome - totalExpense}
              currency="KRW"
              variant="h5"
              fontWeight={600}
              color={totalIncome - totalExpense >= 0 ? 'success.main' : 'error.main'}
              showSign
              signType="auto"
            />
          </CardContent>
        </Card>
      </Stack>

      {/* 거래 목록 */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary" textAlign="center" py={4}>
              이번 달 거래 내역이 없습니다.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {Object.entries(groupedTransactions).map(([date, txList]) => (
            <Card key={date}>
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                  {formatDate(date)}
                </Typography>
                <Stack spacing={1} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                  {txList.map((tx) => (
                    <Stack
                      key={tx.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 1 }}
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Chip
                          label={tx.type === 'expense' ? '지출' : '수입'}
                          size="small"
                          color={tx.type === 'expense' ? 'error' : 'success'}
                          sx={{ minWidth: 50 }}
                        />
                        <Box>
                          <Typography fontWeight={500}>
                            {tx.description || tx.category_name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {tx.category_name}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <AmountText
                          amount={tx.amount}
                          currency={tx.currency}
                          variant="h6"
                          fontWeight={600}
                          color={tx.type === 'expense' ? 'error.main' : 'success.main'}
                          showSign
                          signType={tx.type}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeletingId(tx.id)
                            setDeleteConfirmOpen(true)
                          }}
                        >
                          <IconTrash size={16} />
                        </IconButton>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadTransactions}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>거래 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 거래를 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">
            취소
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
