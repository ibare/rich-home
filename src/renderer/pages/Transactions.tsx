import { useEffect, useState } from 'react'
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
import { IconTrash } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import TransactionModal from '../components/modals/TransactionModal'
import AmountText from '../components/shared/AmountText'
import MonthNavigation from '../components/shared/MonthNavigation'

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

  // 월별 데이터 존재 여부
  const [monthsWithData, setMonthsWithData] = useState<Set<number>>(new Set())

  useEffect(() => {
    setPageTitle('거래 내역')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadMonthsWithData()
  }, [selectedYear])

  useEffect(() => {
    loadTransactions()
  }, [selectedYear, selectedMonth])

  // 해당 연도의 월별 데이터 존재 여부 조회
  const loadMonthsWithData = async () => {
    try {
      const result = await window.electronAPI.db.query(
        `SELECT DISTINCT CAST(strftime('%m', date) AS INTEGER) as month
         FROM transactions
         WHERE strftime('%Y', date) = ?`,
        [String(selectedYear)]
      ) as { month: number }[]

      setMonthsWithData(new Set(result.map((r) => r.month)))
    } catch (error) {
      console.error('Failed to load months with data:', error)
    }
  }

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      const query = `
        SELECT t.*, c.name as category_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.date >= ? AND t.date < ?
        ORDER BY t.date DESC, t.created_at DESC
      `

      const result = await window.electronAPI.db.query(query, [startDate, endDate])
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
      loadMonthsWithData()
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

  const handleSaved = () => {
    loadTransactions()
    loadMonthsWithData()
  }

  return (
    <Box>
      <MonthNavigation
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        monthsWithData={monthsWithData}
      />

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
      {loading ? (
        <Box>
          <Typography>로딩 중...</Typography>
        </Box>
      ) : transactions.length === 0 ? (
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
        onSaved={handleSaved}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
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
