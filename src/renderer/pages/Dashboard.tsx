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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'
import AmountText from '../components/shared/AmountText'
import { useExchangeRate } from '../hooks/useExchangeRate'
import * as dashboardRepo from '../repositories/dashboardRepository'

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

interface MonthlyBudgetComparison {
  month: string
  budget: number
  expense: number
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

  // 최근 3개월 예산 비교
  monthlyBudgetComparison: MonthlyBudgetComparison[]

}

export default function Dashboard() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const { exchangeRate } = useExchangeRate()
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
    monthlyBudgetComparison: [],
  })

  useEffect(() => {
    setPageTitle('대시보드')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadDashboardData()
  }, [exchangeRate])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const result = await dashboardRepo.loadDashboardData(exchangeRate)
      setData(result as DashboardData)
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
        <Grid size={{ xs: 12, md: 4 }}>
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

        {/* 최근 3개월 예산 vs 지출 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <DashboardCard title="월별 예산 vs 지출">
            {data.monthlyBudgetComparison.length === 0 ? (
              <Typography color="textSecondary" textAlign="center" py={4}>
                데이터가 없습니다.
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.monthlyBudgetComparison} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toLocaleString()}원`}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => (value === 'budget' ? '예산' : '지출')}
                  />
                  <Bar dataKey="budget" name="budget" fill="#5D87FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#FA896B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardCard>
        </Grid>

        {/* 카테고리별 지출 */}
        <Grid size={{ xs: 12, md: 4 }}>
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
