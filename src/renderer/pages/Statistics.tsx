import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  ComposedChart,
  Line,
} from 'recharts'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'
import AmountText from '../components/shared/AmountText'

interface MonthlyData {
  month: string
  monthNum: number
  year: number
  income: number
  expense: number
  balance: number
}

export default function Statistics() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [viewType, setViewType] = useState<'flow' | 'bar'>('flow')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setPageTitle('통계')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadMonthlyData()
  }, [selectedYear])

  const loadMonthlyData = async () => {
    setLoading(true)
    try {
      // 환율 조회
      const exchangeRateSetting = (await window.electronAPI.db.query(
        "SELECT value FROM settings WHERE key = 'exchange_rate_aed_krw'"
      )) as { value: string }[]
      const exchangeRate = exchangeRateSetting.length > 0
        ? parseFloat(exchangeRateSetting[0].value)
        : 370

      // 월별 수입/지출 집계
      const result = await window.electronAPI.db.query(`
        SELECT
          strftime('%Y', date) as year,
          strftime('%m', date) as month,
          type,
          currency,
          SUM(amount) as total
        FROM transactions
        WHERE strftime('%Y', date) = ?
        GROUP BY year, month, type, currency
        ORDER BY year, month
      `, [String(selectedYear)]) as {
        year: string
        month: string
        type: string
        currency: string
        total: number
      }[]

      // 월별로 그룹화
      const monthlyMap = new Map<string, { income: number; expense: number }>()

      // 1~12월 초기화
      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`
        monthlyMap.set(key, { income: 0, expense: 0 })
      }

      // 데이터 집계
      for (const row of result) {
        const key = `${row.year}-${row.month}`
        const existing = monthlyMap.get(key) || { income: 0, expense: 0 }
        const amountKRW = row.currency === 'AED' ? row.total * exchangeRate : row.total

        if (row.type === 'income') {
          existing.income += amountKRW
        } else {
          existing.expense += amountKRW
        }
        monthlyMap.set(key, existing)
      }

      // 배열로 변환
      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      const data: MonthlyData[] = []

      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`
        const values = monthlyMap.get(key) || { income: 0, expense: 0 }
        data.push({
          month: monthNames[m - 1],
          monthNum: m,
          year: selectedYear,
          income: Math.round(values.income),
          expense: Math.round(values.expense),
          balance: Math.round(values.income - values.expense),
        })
      }

      setMonthlyData(data)
    } catch (error) {
      console.error('Failed to load monthly data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 현재까지의 총계
  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0)
  const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0)
  const totalBalance = totalIncome - totalExpense

  // 전월 대비 변화율 (최근 데이터 있는 달 기준)
  const currentMonth = new Date().getMonth() + 1
  const lastMonthWithData = monthlyData
    .filter(d => d.income > 0 || d.expense > 0)
    .slice(-1)[0]
  const prevMonthWithData = monthlyData
    .filter(d => d.income > 0 || d.expense > 0)
    .slice(-2, -1)[0]

  const expenseChange = prevMonthWithData && lastMonthWithData && prevMonthWithData.expense > 0
    ? ((lastMonthWithData.expense - prevMonthWithData.expense) / prevMonthWithData.expense) * 100
    : 0

  // 차트 색상
  const colors = {
    income: '#13DEB9',
    incomeLight: '#E6FFFA',
    expense: '#5D87FF',
    expenseLight: '#ECF2FF',
    balance: '#49BEFF',
  }

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`
    }
    return value.toString()
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card sx={{ p: 1.5, boxShadow: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Stack key={index} direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" sx={{ color: entry.color }}>
                {entry.name}:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {entry.value.toLocaleString()}원
              </Typography>
            </Stack>
          ))}
        </Card>
      )
    }
    return null
  }

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* 연도 선택 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {selectedYear}년 통계
        </Typography>
        <ToggleButtonGroup
          value={selectedYear}
          exclusive
          onChange={(_, value) => value && setSelectedYear(value)}
          size="small"
        >
          {[selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
            <ToggleButton key={year} value={year} sx={{ px: 2 }}>
              {year}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* 요약 카드 */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="textSecondary">
                총 수입
              </Typography>
              <AmountText
                amount={totalIncome}
                currency="KRW"
                variant="h4"
                fontWeight={700}
                color="success.main"
              />
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="textSecondary">
                총 지출
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AmountText
                  amount={totalExpense}
                  currency="KRW"
                  variant="h4"
                  fontWeight={700}
                  color="primary.main"
                />
                {expenseChange !== 0 && (
                  <Chip
                    icon={expenseChange > 0 ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
                    label={`${Math.abs(expenseChange).toFixed(1)}%`}
                    size="small"
                    sx={{
                      bgcolor: expenseChange > 0 ? 'error.light' : 'success.light',
                      color: expenseChange > 0 ? 'error.main' : 'success.main',
                      fontWeight: 600,
                      '& .MuiChip-icon': {
                        color: 'inherit',
                      },
                    }}
                  />
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="textSecondary">
                순수익
              </Typography>
              <AmountText
                amount={totalBalance}
                currency="KRW"
                variant="h4"
                fontWeight={700}
                color={totalBalance >= 0 ? 'success.main' : 'error.main'}
                showSign
                signType="auto"
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* 차트 타입 선택 */}
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={viewType}
          exclusive
          onChange={(_, value) => value && setViewType(value)}
          size="small"
        >
          <ToggleButton value="flow" sx={{ px: 2 }}>
            흐름 차트
          </ToggleButton>
          <ToggleButton value="bar" sx={{ px: 2 }}>
            막대 차트
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* 월별 흐름 차트 */}
      <DashboardCard title="월별 수입/지출 흐름">
        <Box sx={{ height: 400, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'flow' ? (
              <AreaChart
                data={monthlyData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.income} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={colors.income} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.expense} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={colors.expense} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5A6A85', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5A6A85', fontSize: 12 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: '#5A6A85', fontSize: 12 }}>{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="수입"
                  stroke={colors.income}
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="지출"
                  stroke={colors.expense}
                  strokeWidth={2}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            ) : (
              <ComposedChart
                data={monthlyData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5A6A85', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#5A6A85', fontSize: 12 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: '#5A6A85', fontSize: 12 }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="income"
                  name="수입"
                  fill={colors.income}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="expense"
                  name="지출"
                  fill={colors.expense}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="잔액"
                  stroke={colors.balance}
                  strokeWidth={2}
                  dot={{ fill: colors.balance, strokeWidth: 2 }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </Box>
      </DashboardCard>

      {/* 월별 상세 테이블 */}
      <DashboardCard title="월별 상세" sx={{ mt: 3 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Stack
            direction="row"
            spacing={0}
            sx={{
              minWidth: 800,
              py: 2,
            }}
          >
            {monthlyData.map((data, index) => {
              const hasData = data.income > 0 || data.expense > 0
              const prevData = index > 0 ? monthlyData[index - 1] : null
              const expenseChangeFromPrev = prevData && prevData.expense > 0
                ? ((data.expense - prevData.expense) / prevData.expense) * 100
                : 0

              return (
                <Box
                  key={data.month}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    px: 1,
                    borderRight: index < 11 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    opacity: hasData ? 1 : 0.4,
                  }}
                >
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {data.month}
                  </Typography>

                  {/* 수입 막대 */}
                  <Box
                    sx={{
                      height: 60,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      mb: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: '70%',
                        height: `${Math.min((data.income / Math.max(...monthlyData.map(d => d.income), 1)) * 50, 50)}px`,
                        bgcolor: colors.income,
                        borderRadius: '4px 4px 0 0',
                        minHeight: hasData && data.income > 0 ? 4 : 0,
                      }}
                    />
                  </Box>

                  {/* 지출 막대 */}
                  <Box
                    sx={{
                      height: 60,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      mt: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: '70%',
                        height: `${Math.min((data.expense / Math.max(...monthlyData.map(d => d.expense), 1)) * 50, 50)}px`,
                        bgcolor: colors.expense,
                        borderRadius: '0 0 4px 4px',
                        minHeight: hasData && data.expense > 0 ? 4 : 0,
                      }}
                    />
                  </Box>

                  {/* 금액 표시 */}
                  {hasData && (
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ color: colors.income, fontWeight: 600 }}>
                        +{(data.income / 10000).toFixed(0)}만
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.expense, fontWeight: 600 }}>
                        -{(data.expense / 10000).toFixed(0)}만
                      </Typography>
                    </Stack>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      </DashboardCard>
    </Box>
  )
}
