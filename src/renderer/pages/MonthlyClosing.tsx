import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  TextField,
} from '@mui/material'
import {
  IconCheck,
  IconLock,
  IconTrash,
  IconAlertCircle,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import AmountText from '../components/shared/AmountText'
import MonthNavigation from '../components/shared/MonthNavigation'

interface MonthlyData {
  totalIncome: number
  totalExpense: number
  totalBudget: number | null
  categoryDetails: CategoryDetail[]
}

interface CategoryDetail {
  id: string
  name: string
  type: 'income' | 'expense'
  amount: number
  budgetAmount: number | null
}

interface ClosingRecord {
  id: string
  year: number
  month: number
  total_income: number
  total_expense: number
  total_budget: number | null
  net_amount: number
  memo: string | null
  closed_at: string
}

export default function MonthlyClosing() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [loading, setLoading] = useState(true)

  // 선택된 연/월
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // 데이터
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null)
  const [existingClosing, setExistingClosing] = useState<ClosingRecord | null>(null)
  const [closingHistory, setClosingHistory] = useState<ClosingRecord[]>([])

  // 다이얼로그
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [closingMemo, setClosingMemo] = useState('')
  const [processing, setProcessing] = useState(false)

  // 월별 데이터 존재 여부
  const [monthsWithData, setMonthsWithData] = useState<Set<number>>(new Set())

  useEffect(() => {
    setPageTitle('월 마감')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadMonthsWithData()
  }, [selectedYear])

  useEffect(() => {
    loadData()
  }, [selectedYear, selectedMonth])

  useEffect(() => {
    loadClosingHistory()
  }, [])

  // 해당 연도의 월별 데이터 존재 여부 조회 (마감 또는 거래내역 있는 월)
  const loadMonthsWithData = async () => {
    try {
      const result = await window.electronAPI.db.query(
        `SELECT DISTINCT month FROM (
          SELECT month FROM monthly_closings WHERE year = ?
          UNION
          SELECT CAST(strftime('%m', date) AS INTEGER) as month
          FROM transactions
          WHERE strftime('%Y', date) = ?
        )`,
        [selectedYear, String(selectedYear)]
      ) as { month: number }[]

      setMonthsWithData(new Set(result.map((r) => r.month)))
    } catch (error) {
      console.error('Failed to load months with data:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // 해당 월의 거래 데이터 조회
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = selectedMonth === 12
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 카테고리별 합계 (통계 포함 거래만)
      const categoryData = await window.electronAPI.db.query(`
        SELECT
          c.id,
          c.name,
          t.type,
          SUM(t.amount) as amount
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.date >= ? AND t.date < ? AND t.include_in_stats = 1
        GROUP BY c.id, t.type
        ORDER BY t.type, amount DESC
      `, [startDate, endDate]) as { id: string; name: string; type: 'income' | 'expense'; amount: number }[]

      // 예산 데이터 조회
      const budgetData = await window.electronAPI.db.query(`
        SELECT
          mb.amount as budget_amount,
          bic.category_id
        FROM monthly_budgets mb
        JOIN budget_items bi ON mb.budget_item_id = bi.id
        LEFT JOIN budget_item_categories bic ON bi.id = bic.budget_item_id
        WHERE mb.year = ? AND mb.month = ?
      `, [selectedYear, selectedMonth]) as { budget_amount: number; category_id: string | null }[]

      // 카테고리별 예산 매핑
      const budgetByCategory = new Map<string, number>()
      let totalBudget = 0
      budgetData.forEach(b => {
        if (b.category_id) {
          budgetByCategory.set(b.category_id, (budgetByCategory.get(b.category_id) || 0) + b.budget_amount)
        }
        totalBudget += b.budget_amount
      })

      // 카테고리 상세 데이터 구성
      const categoryDetails: CategoryDetail[] = categoryData.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        amount: c.amount,
        budgetAmount: budgetByCategory.get(c.id) || null,
      }))

      const totalIncome = categoryDetails
        .filter(c => c.type === 'income')
        .reduce((sum, c) => sum + c.amount, 0)
      const totalExpense = categoryDetails
        .filter(c => c.type === 'expense')
        .reduce((sum, c) => sum + c.amount, 0)

      setMonthlyData({
        totalIncome,
        totalExpense,
        totalBudget: totalBudget > 0 ? totalBudget : null,
        categoryDetails,
      })

      // 기존 마감 데이터 확인
      const existing = await window.electronAPI.db.get(
        'SELECT * FROM monthly_closings WHERE year = ? AND month = ?',
        [selectedYear, selectedMonth]
      ) as ClosingRecord | undefined

      setExistingClosing(existing || null)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClosingHistory = async () => {
    try {
      const history = await window.electronAPI.db.query(
        'SELECT * FROM monthly_closings ORDER BY year DESC, month DESC LIMIT 12'
      ) as ClosingRecord[]
      setClosingHistory(history)
    } catch (error) {
      console.error('Failed to load closing history:', error)
    }
  }

  const handleClose = async () => {
    if (!monthlyData) return

    setProcessing(true)
    try {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      // 마감 데이터 저장
      await window.electronAPI.db.query(`
        INSERT INTO monthly_closings (id, year, month, total_income, total_expense, total_budget, net_amount, memo, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        selectedYear,
        selectedMonth,
        monthlyData.totalIncome,
        monthlyData.totalExpense,
        monthlyData.totalBudget,
        monthlyData.totalIncome - monthlyData.totalExpense,
        closingMemo || null,
        now,
      ])

      // 카테고리별 상세 저장
      for (const detail of monthlyData.categoryDetails) {
        await window.electronAPI.db.query(`
          INSERT INTO monthly_closing_details (id, closing_id, category_id, category_name, type, amount, budget_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          id,
          detail.id,
          detail.name,
          detail.type,
          detail.amount,
          detail.budgetAmount,
        ])
      }

      // 해당 월 예산도 함께 확정
      await window.electronAPI.db.query(
        'UPDATE monthly_budgets SET is_confirmed = 1 WHERE year = ? AND month = ?',
        [selectedYear, selectedMonth]
      )

      setConfirmDialogOpen(false)
      setClosingMemo('')
      loadData()
      loadClosingHistory()
    } catch (error) {
      console.error('Failed to close month:', error)
      alert('월 마감에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!existingClosing) return

    setProcessing(true)
    try {
      await window.electronAPI.db.query(
        'DELETE FROM monthly_closings WHERE id = ?',
        [existingClosing.id]
      )

      // 해당 월 예산도 함께 확정 해제
      await window.electronAPI.db.query(
        'UPDATE monthly_budgets SET is_confirmed = 0 WHERE year = ? AND month = ?',
        [selectedYear, selectedMonth]
      )

      setDeleteDialogOpen(false)
      loadData()
      loadClosingHistory()
    } catch (error) {
      console.error('Failed to delete closing:', error)
      alert('마감 취소에 실패했습니다.')
    } finally {
      setProcessing(false)
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

  const netAmount = monthlyData ? monthlyData.totalIncome - monthlyData.totalExpense : 0
  const budgetUsageRate = monthlyData?.totalBudget
    ? Math.round((monthlyData.totalExpense / monthlyData.totalBudget) * 100)
    : null

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <MonthNavigation
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        monthsWithData={monthsWithData}
        actionSlot={
          existingClosing ? (
            <Chip
              icon={<IconLock size={14} />}
              label="마감 완료"
              color="success"
            />
          ) : (
            <Chip
              icon={<IconAlertCircle size={14} />}
              label="미마감"
              color="warning"
              variant="outlined"
            />
          )
        }
      />

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                수입
              </Typography>
              <AmountText
                amount={monthlyData?.totalIncome || 0}
                currency="KRW"
                variant="h4"
                fontWeight={600}
                color="success.main"
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                지출
              </Typography>
              <AmountText
                amount={monthlyData?.totalExpense || 0}
                currency="KRW"
                variant="h4"
                fontWeight={600}
                color="error.main"
              />
              {budgetUsageRate !== null && (
                <Box sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="textSecondary">
                      예산 대비
                    </Typography>
                    <Typography
                      variant="caption"
                      color={budgetUsageRate > 100 ? 'error.main' : 'textSecondary'}
                      fontWeight={600}
                    >
                      {budgetUsageRate}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(budgetUsageRate, 100)}
                    color={budgetUsageRate > 100 ? 'error' : budgetUsageRate > 80 ? 'warning' : 'primary'}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                순수익
              </Typography>
              <AmountText
                amount={netAmount}
                currency="KRW"
                variant="h4"
                fontWeight={600}
                color={netAmount >= 0 ? 'success.main' : 'error.main'}
                showSign
                signType="auto"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 마감 상태 및 액션 */}
      {existingClosing ? (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button
              color="error"
              size="small"
              onClick={() => setDeleteDialogOpen(true)}
              startIcon={<IconTrash size={16} />}
            >
              마감 취소
            </Button>
          }
        >
          <Typography variant="body2">
            {formatDate(existingClosing.closed_at)}에 마감되었습니다.
            {existingClosing.memo && ` (메모: ${existingClosing.memo})`}
          </Typography>
        </Alert>
      ) : (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" gutterBottom>
                  {selectedYear}년 {selectedMonth}월 마감
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  해당 월의 수입/지출 데이터를 확정합니다. 마감 후에도 거래 내역 수정은 가능합니다.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                startIcon={<IconCheck size={18} />}
                onClick={() => setConfirmDialogOpen(true)}
                disabled={!monthlyData || (monthlyData.totalIncome === 0 && monthlyData.totalExpense === 0)}
              >
                마감하기
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 카테고리별 상세 */}
      {monthlyData && monthlyData.categoryDetails.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              카테고리별 내역
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>카테고리</TableCell>
                    <TableCell>구분</TableCell>
                    <TableCell align="right">금액</TableCell>
                    <TableCell align="right">예산</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthlyData.categoryDetails.map((detail) => (
                    <TableRow key={`${detail.id}-${detail.type}`} hover>
                      <TableCell>{detail.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={detail.type === 'income' ? '수입' : '지출'}
                          size="small"
                          color={detail.type === 'income' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <AmountText
                          amount={detail.amount}
                          currency="KRW"
                          fontWeight={500}
                          color={detail.type === 'income' ? 'success.main' : 'error.main'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {detail.budgetAmount ? (
                          <AmountText
                            amount={detail.budgetAmount}
                            currency="KRW"
                            color="textSecondary"
                          />
                        ) : (
                          <Typography color="textSecondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* 마감 히스토리 */}
      {closingHistory.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              마감 히스토리
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>연월</TableCell>
                    <TableCell align="right">수입</TableCell>
                    <TableCell align="right">지출</TableCell>
                    <TableCell align="right">순수익</TableCell>
                    <TableCell>마감일</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {closingHistory.map((record) => (
                    <TableRow
                      key={record.id}
                      hover
                      selected={record.year === selectedYear && record.month === selectedMonth}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedYear(record.year)
                        setSelectedMonth(record.month)
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={500}>
                          {record.year}년 {record.month}월
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <AmountText
                          amount={record.total_income}
                          currency="KRW"
                          color="success.main"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <AmountText
                          amount={record.total_expense}
                          currency="KRW"
                          color="error.main"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <AmountText
                          amount={record.net_amount}
                          currency="KRW"
                          fontWeight={600}
                          color={record.net_amount >= 0 ? 'success.main' : 'error.main'}
                          showSign
                          signType="auto"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {new Date(record.closed_at).toLocaleDateString('ko-KR')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* 마감 확인 다이얼로그 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedYear}년 {selectedMonth}월 마감</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography color="textSecondary">수입:</Typography>
                <AmountText amount={monthlyData?.totalIncome || 0} currency="KRW" color="success.main" />
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography color="textSecondary">지출:</Typography>
                <AmountText amount={monthlyData?.totalExpense || 0} currency="KRW" color="error.main" />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={600}>순수익:</Typography>
                <AmountText
                  amount={netAmount}
                  currency="KRW"
                  fontWeight={600}
                  color={netAmount >= 0 ? 'success.main' : 'error.main'}
                  showSign
                  signType="auto"
                />
              </Stack>
            </Box>
            <TextField
              label="메모 (선택)"
              value={closingMemo}
              onChange={(e) => setClosingMemo(e.target.value)}
              multiline
              rows={2}
              fullWidth
              placeholder="마감에 대한 메모를 남겨보세요"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDialogOpen(false)} color="inherit">
            취소
          </Button>
          <Button
            onClick={handleClose}
            variant="contained"
            disabled={processing}
            startIcon={<IconCheck size={18} />}
          >
            {processing ? '처리 중...' : '마감하기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 마감 취소 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>마감 취소</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedYear}년 {selectedMonth}월 마감을 취소하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
            닫기
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={processing}
          >
            {processing ? '처리 중...' : '마감 취소'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
