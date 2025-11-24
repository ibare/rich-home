import { useEffect, useState } from 'react'
import {
  Box,
  Grid,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Skeleton,
} from '@mui/material'
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconBuildingBank,
  IconHome,
  IconCreditCard,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'
import AmountText from '../components/shared/AmountText'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_name: string
  date: string
  description: string | null
}

interface CategoryExpense {
  category_id: string
  category_name: string
  total: number
  color: string
}

interface DashboardData {
  // 자산 현황
  totalAccountBalance: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number

  // 이번 달
  monthlyIncome: number
  monthlyExpense: number
  monthlyBudget: number

  // 최근 거래
  recentTransactions: Transaction[]

  // 카테고리별 지출
  categoryExpenses: CategoryExpense[]

  // 환율
  exchangeRate: number
}

export default function Dashboard() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData>({
    totalAccountBalance: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBudget: 0,
    recentTransactions: [],
    categoryExpenses: [],
    exchangeRate: 370,
  })

  useEffect(() => {
    setPageTitle('대시보드')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`

      // 환율 조회
      const exchangeRateSetting = (await window.electronAPI.db.query(
        "SELECT value FROM settings WHERE key = 'exchange_rate_aed_krw'"
      )) as { value: string }[]
      const exchangeRate = exchangeRateSetting.length > 0
        ? parseFloat(exchangeRateSetting[0].value)
        : 370

      // 계좌 잔고 (각 계좌의 최신 잔고)
      const accountBalances = (await window.electronAPI.db.query(`
        SELECT a.currency, ab.balance
        FROM accounts a
        LEFT JOIN (
          SELECT account_id, balance, recorded_at,
                 ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY recorded_at DESC) as rn
          FROM account_balances
        ) ab ON a.id = ab.account_id AND ab.rn = 1
        WHERE a.is_active = 1
      `)) as { currency: string; balance: number | null }[]

      let totalAccountBalance = 0
      for (const acc of accountBalances) {
        if (acc.balance !== null) {
          if (acc.currency === 'AED') {
            totalAccountBalance += acc.balance * exchangeRate
          } else {
            totalAccountBalance += acc.balance
          }
        }
      }

      // 자산 총액
      const assets = (await window.electronAPI.db.query(`
        SELECT purchase_amount, quantity, currency FROM assets WHERE is_active = 1
      `)) as { purchase_amount: number; quantity: number; currency: string }[]

      let totalAssets = 0
      for (const asset of assets) {
        const value = asset.purchase_amount * asset.quantity
        if (asset.currency === 'AED') {
          totalAssets += value * exchangeRate
        } else {
          totalAssets += value
        }
      }

      // 부채 총액
      const liabilities = (await window.electronAPI.db.query(`
        SELECT current_balance, currency FROM liabilities WHERE is_active = 1
      `)) as { current_balance: number; currency: string }[]

      let totalLiabilities = 0
      for (const liability of liabilities) {
        if (liability.currency === 'AED') {
          totalLiabilities += liability.current_balance * exchangeRate
        } else {
          totalLiabilities += liability.current_balance
        }
      }

      // 이번 달 수입/지출 (통계 포함 거래만)
      const monthlyTransactions = (await window.electronAPI.db.query(`
        SELECT type, amount, currency FROM transactions
        WHERE date >= ? AND date < ? AND include_in_stats = 1
      `, [startDate, endDate])) as { type: string; amount: number; currency: string }[]

      let monthlyIncome = 0
      let monthlyExpense = 0
      for (const tx of monthlyTransactions) {
        const amountKRW = tx.currency === 'AED' ? tx.amount * exchangeRate : tx.amount
        if (tx.type === 'income') {
          monthlyIncome += amountKRW
        } else {
          monthlyExpense += amountKRW
        }
      }

      // 이번 달 예산 (budget_items에서 직접 계산)
      // distributed 예산은 기간 기반 월 분배액 계산, 유효 기간 내인 것만 포함
      const budgetItemsResult = (await window.electronAPI.db.query(`
        SELECT
          CASE
            WHEN budget_type = 'distributed' AND valid_from IS NOT NULL AND valid_to IS NOT NULL THEN
              ROUND(base_amount / MAX(1, (
                (CAST(strftime('%Y', valid_to) AS INTEGER) - CAST(strftime('%Y', valid_from) AS INTEGER)) * 12 +
                (CAST(strftime('%m', valid_to) AS INTEGER) - CAST(strftime('%m', valid_from) AS INTEGER)) + 1
              )))
            ELSE base_amount
          END as monthly_amount,
          currency
        FROM budget_items
        WHERE is_active = 1
          AND (
            budget_type != 'distributed'
            OR (valid_from < ? AND valid_to >= ?)
          )
      `, [endDate, startDate])) as { monthly_amount: number; currency: string }[]

      let monthlyBudget = 0
      for (const budget of budgetItemsResult) {
        if (budget.currency === 'AED') {
          monthlyBudget += budget.monthly_amount * exchangeRate
        } else {
          monthlyBudget += budget.monthly_amount
        }
      }

      // 최근 거래 (최근 10건)
      const recentTransactions = (await window.electronAPI.db.query(`
        SELECT t.id, t.type, t.amount, t.currency, t.date, t.description, c.name as category_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 10
      `)) as Transaction[]

      // 카테고리별 지출 (이번 달, 통계 포함 거래만)
      const categoryExpenses = (await window.electronAPI.db.query(`
        SELECT t.category_id, c.name as category_name, c.color,
               SUM(CASE WHEN t.currency = 'AED' THEN t.amount * ? ELSE t.amount END) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense' AND t.date >= ? AND t.date < ? AND t.include_in_stats = 1
        GROUP BY t.category_id
        ORDER BY total DESC
        LIMIT 5
      `, [exchangeRate, startDate, endDate])) as CategoryExpense[]

      setData({
        totalAccountBalance,
        totalAssets,
        totalLiabilities,
        netWorth: totalAccountBalance + totalAssets - totalLiabilities,
        monthlyIncome,
        monthlyExpense,
        monthlyBudget,
        recentTransactions,
        categoryExpenses,
        exchangeRate,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // KRW로 환산된 금액 표시용 (대시보드는 모두 KRW 환산)
  const renderAmount = (amount: number, variant: 'h5' | 'h6' | 'body1' | 'body2' = 'h5', fontWeight = 600, color?: string) => (
    <AmountText amount={amount} currency="KRW" variant={variant} fontWeight={fontWeight} color={color as any} />
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    })
  }

  const budgetUsagePercent = data.monthlyBudget > 0
    ? Math.min((data.monthlyExpense / data.monthlyBudget) * 100, 100)
    : 0

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Skeleton variant="rounded" height={300} />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Skeleton variant="rounded" height={300} />
          </Grid>
        </Grid>
      </Box>
    )
  }

  return (
    <Box>
      <Grid container spacing={3}>
        {/* 순자산 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <DashboardCard>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconWallet size={18} color="#5D87FF" />
                <Typography variant="body2" color="textSecondary">
                  순자산
                </Typography>
              </Stack>
              <AmountText amount={data.netWorth} currency="KRW" variant="h4" fontWeight={700} />
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 계좌 잔고 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <DashboardCard>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconBuildingBank size={18} color="#49BEFF" />
                <Typography variant="body2" color="textSecondary">
                  계좌 잔고
                </Typography>
              </Stack>
              <AmountText amount={data.totalAccountBalance} currency="KRW" variant="h4" fontWeight={700} />
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 자산 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <DashboardCard>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconHome size={18} color="#13DEB9" />
                <Typography variant="body2" color="textSecondary">
                  자산
                </Typography>
              </Stack>
              <AmountText amount={data.totalAssets} currency="KRW" variant="h4" fontWeight={700} />
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 부채 */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <DashboardCard>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconCreditCard size={18} color="#FA896B" />
                <Typography variant="body2" color="textSecondary">
                  부채
                </Typography>
              </Stack>
              <AmountText amount={data.totalLiabilities} currency="KRW" variant="h4" fontWeight={700} />
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 이번 달 수입/지출 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard title="이번 달 현황">
            <Stack spacing={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconArrowUpRight size={20} color="#13DEB9" />
                  <Typography>수입</Typography>
                </Stack>
                <AmountText amount={data.monthlyIncome} currency="KRW" variant="h6" fontWeight={600} color="success.main" showSign signType="income" />
              </Stack>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconArrowDownRight size={20} color="#FA896B" />
                  <Typography>지출</Typography>
                </Stack>
                <AmountText amount={data.monthlyExpense} currency="KRW" variant="h6" fontWeight={600} color="error.main" showSign signType="expense" />
              </Stack>

              {data.monthlyBudget > 0 && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="textSecondary">
                      예산 사용률
                    </Typography>
                    <Typography variant="body2" color="textSecondary" component="span">
                      <AmountText amount={data.monthlyExpense} currency="KRW" variant="body2" color="textSecondary" /> / <AmountText amount={data.monthlyBudget} currency="KRW" variant="body2" color="textSecondary" />
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={budgetUsagePercent}
                    color={budgetUsagePercent > 90 ? 'error' : budgetUsagePercent > 70 ? 'warning' : 'primary'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
                    {budgetUsagePercent.toFixed(1)}% 사용
                  </Typography>
                </Box>
              )}

              <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={500}>잔액</Typography>
                  <AmountText
                    amount={data.monthlyIncome - data.monthlyExpense}
                    currency="KRW"
                    variant="h5"
                    fontWeight={600}
                    color={data.monthlyIncome - data.monthlyExpense >= 0 ? 'success.main' : 'error.main'}
                    showSign
                    signType="auto"
                  />
                </Stack>
              </Box>
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 카테고리별 지출 */}
        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard title="카테고리별 지출 (이번 달)">
            {data.categoryExpenses.length === 0 ? (
              <Typography color="textSecondary" textAlign="center" py={4}>
                이번 달 지출 내역이 없습니다.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {data.categoryExpenses.map((cat) => {
                  const percent = data.monthlyExpense > 0
                    ? (cat.total / data.monthlyExpense) * 100
                    : 0
                  return (
                    <Box key={cat.category_id}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2">{cat.category_name}</Typography>
                        <AmountText amount={cat.total} currency="KRW" variant="body2" fontWeight={500} />
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={percent}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: cat.color || 'primary.main',
                          },
                        }}
                      />
                    </Box>
                  )
                })}
              </Stack>
            )}
          </DashboardCard>
        </Grid>

        {/* 최근 거래 */}
        <Grid size={{ xs: 12 }}>
          <DashboardCard title="최근 거래">
            {data.recentTransactions.length === 0 ? (
              <Typography color="textSecondary" textAlign="center" py={4}>
                거래 내역이 없습니다. 새 거래를 추가해보세요.
              </Typography>
            ) : (
              <Stack spacing={1} divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
                {data.recentTransactions.map((tx) => (
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
                        <Typography variant="caption" color="textSecondary">
                          {formatDate(tx.date)} · {tx.category_name}
                        </Typography>
                      </Box>
                    </Stack>
                    <AmountText
                      amount={tx.amount}
                      currency={tx.currency}
                      fontWeight={600}
                      color={tx.type === 'expense' ? 'error.main' : 'success.main'}
                      showSign
                      signType={tx.type}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  )
}
