import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
} from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import DashboardCard from '../../components/shared/DashboardCard'
import AmountText from '../../components/shared/AmountText'
import MonthNavigation from '../../components/shared/MonthNavigation'
import { CATEGORY_COLORS } from '../../../shared/constants'

interface BudgetItemStat {
  id: string
  name: string
  group_name: string | null
  budgetAmount: number
  spentAmount: number
  currency: string
  categories: string[]
}

interface MonthlyCategoryStat {
  id: string
  name: string
  amount: number
  color: string
}

interface TagStat {
  tag: string
  amount: number
  color: string
}

interface MonthlyStatisticsProps {
  exchangeRate: number
}

export default function MonthlyStatistics({ exchangeRate }: MonthlyStatisticsProps) {
  const [monthlySelectedYear, setMonthlySelectedYear] = useState(new Date().getFullYear())
  const [monthlySelectedMonth, setMonthlySelectedMonth] = useState(new Date().getMonth() + 1)
  const [budgetItemStats, setBudgetItemStats] = useState<BudgetItemStat[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyCategoryStats, setMonthlyCategoryStats] = useState<MonthlyCategoryStat[]>([])
  const [monthlyTagStats, setMonthlyTagStats] = useState<TagStat[]>([])
  const [monthsWithData, setMonthsWithData] = useState<number[]>([])

  useEffect(() => {
    loadMonthlyStatsData()
  }, [monthlySelectedYear, monthlySelectedMonth, exchangeRate])

  useEffect(() => {
    loadMonthsWithData()
  }, [monthlySelectedYear])

  const loadMonthsWithData = async () => {
    try {
      const result = await window.electronAPI.db.query(`
        SELECT DISTINCT CAST(strftime('%m', date) AS INTEGER) as month
        FROM transactions
        WHERE strftime('%Y', date) = ?
          AND include_in_stats = 1
        ORDER BY month
      `, [String(monthlySelectedYear)]) as { month: number }[]
      setMonthsWithData(result.map(r => r.month))
    } catch (error) {
      console.error('Failed to load months with data:', error)
    }
  }

  const loadMonthlyStatsData = async () => {
    setMonthlyLoading(true)
    try {
      const startDate = `${monthlySelectedYear}-${String(monthlySelectedMonth).padStart(2, '0')}-01`
      const endMonth = monthlySelectedMonth === 12 ? 1 : monthlySelectedMonth + 1
      const endYear = monthlySelectedMonth === 12 ? monthlySelectedYear + 1 : monthlySelectedYear
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      // 1. 예산 항목 목록 조회
      const budgetItems = await window.electronAPI.db.query(`
        SELECT bi.id, bi.name, bi.group_name, bi.base_amount, bi.currency,
               GROUP_CONCAT(bic.category_id) as category_ids,
               GROUP_CONCAT(c.name) as category_names
        FROM budget_items bi
        LEFT JOIN budget_item_categories bic ON bi.id = bic.budget_item_id
        LEFT JOIN categories c ON bic.category_id = c.id
        WHERE bi.is_active = 1
        GROUP BY bi.id
        ORDER BY bi.group_name, bi.sort_order, bi.name
      `) as {
        id: string
        name: string
        group_name: string | null
        base_amount: number
        currency: string
        category_ids: string | null
        category_names: string | null
      }[]

      // 2. 해당 월의 카테고리별 지출 집계
      const categoryExpenses = await window.electronAPI.db.query(`
        SELECT
          category_id,
          currency,
          SUM(amount) as total
        FROM transactions
        WHERE type = 'expense'
          AND include_in_stats = 1
          AND date >= ? AND date < ?
        GROUP BY category_id, currency
      `, [startDate, endDate]) as {
        category_id: string
        currency: string
        total: number
      }[]

      // 카테고리별 지출 맵 (KRW 환산)
      const categoryExpenseMap = new Map<string, number>()
      categoryExpenses.forEach(exp => {
        const amountKRW = exp.currency === 'AED' ? exp.total * exchangeRate : exp.total
        categoryExpenseMap.set(
          exp.category_id,
          (categoryExpenseMap.get(exp.category_id) || 0) + amountKRW
        )
      })

      // 3. 예산 항목별 통계 계산
      const stats: BudgetItemStat[] = budgetItems.map(item => {
        const budgetAmount = item.base_amount
        const budgetAmountKRW = item.currency === 'AED' ? budgetAmount * exchangeRate : budgetAmount

        const categoryIds = item.category_ids ? item.category_ids.split(',') : []
        const spentAmount = categoryIds.reduce((sum, catId) => {
          return sum + (categoryExpenseMap.get(catId) || 0)
        }, 0)

        return {
          id: item.id,
          name: item.name,
          group_name: item.group_name,
          budgetAmount: Math.round(budgetAmountKRW),
          spentAmount: Math.round(spentAmount),
          currency: item.currency,
          categories: item.category_names ? item.category_names.split(',') : [],
        }
      })

      setBudgetItemStats(stats)

      // 4. 카테고리별 지출 통계
      const categoryStats = await window.electronAPI.db.query(`
        SELECT
          c.id,
          c.name,
          t.currency,
          SUM(t.amount) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.type = 'expense'
          AND t.include_in_stats = 1
          AND t.date >= ? AND t.date < ?
        GROUP BY c.id, t.currency
        ORDER BY total DESC
      `, [startDate, endDate]) as {
        id: string
        name: string
        currency: string
        total: number
      }[]

      const catTotals = new Map<string, { id: string; name: string; total: number }>()
      categoryStats.forEach(stat => {
        const amountKRW = stat.currency === 'AED' ? stat.total * exchangeRate : stat.total
        const existing = catTotals.get(stat.id) || { id: stat.id, name: stat.name, total: 0 }
        existing.total += amountKRW
        catTotals.set(stat.id, existing)
      })

      const sortedCatStats: MonthlyCategoryStat[] = Array.from(catTotals.values())
        .sort((a, b) => b.total - a.total)
        .map((cat, index) => ({
          id: cat.id,
          name: cat.name,
          amount: Math.round(cat.total),
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }))

      setMonthlyCategoryStats(sortedCatStats)

      // 5. 태그별 지출 통계
      const tagStats = await window.electronAPI.db.query(`
        SELECT
          t.tag,
          t.currency,
          SUM(t.amount) as total
        FROM transactions t
        WHERE t.type = 'expense'
          AND t.include_in_stats = 1
          AND t.date >= ? AND t.date < ?
          AND t.tag IS NOT NULL AND t.tag != ''
        GROUP BY t.tag, t.currency
      `, [startDate, endDate]) as {
        tag: string
        currency: string
        total: number
      }[]

      const tagTotals = new Map<string, number>()
      tagStats.forEach(stat => {
        const amountKRW = stat.currency === 'AED' ? stat.total * exchangeRate : stat.total
        stat.tag.split(',').forEach(t => {
          const trimmed = t.trim()
          if (trimmed) {
            const existing = tagTotals.get(trimmed) || 0
            tagTotals.set(trimmed, existing + amountKRW)
          }
        })
      })

      const sortedTagStats: TagStat[] = Array.from(tagTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag, amount], index) => ({
          tag,
          amount: Math.round(amount),
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }))

      setMonthlyTagStats(sortedTagStats)
    } catch (error) {
      console.error('Failed to load monthly stats data:', error)
    } finally {
      setMonthlyLoading(false)
    }
  }

  const totalMonthlyBudget = budgetItemStats.reduce((sum, item) => sum + item.budgetAmount, 0)
  const totalMonthlySpent = budgetItemStats.reduce((sum, item) => sum + item.spentAmount, 0)

  return (
    <Box>
      <MonthNavigation
        selectedYear={monthlySelectedYear}
        selectedMonth={monthlySelectedMonth}
        onYearChange={setMonthlySelectedYear}
        onMonthChange={setMonthlySelectedMonth}
        monthsWithData={new Set(monthsWithData)}
      />

      {monthlyLoading ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography>로딩 중...</Typography>
        </Box>
      ) : (
        <>
          {/* 예산 항목별 통계 */}
          <DashboardCard title="예산 항목별 통계">
            {budgetItemStats.length === 0 ? (
              <Typography color="textSecondary" textAlign="center" py={4}>
                예산 항목이 없습니다.
              </Typography>
            ) : (
              <>
                <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
                  <Card sx={{ flex: 1, bgcolor: 'primary.lighter' }}>
                    <CardContent sx={{ py: 2 }}>
                      <Typography variant="body2" color="textSecondary">총 예산</Typography>
                      <AmountText amount={totalMonthlyBudget} currency="KRW" variant="h5" fontWeight={600} />
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1, bgcolor: totalMonthlySpent <= totalMonthlyBudget ? 'success.lighter' : 'error.lighter' }}>
                    <CardContent sx={{ py: 2 }}>
                      <Typography variant="body2" color="textSecondary">총 지출</Typography>
                      <AmountText
                        amount={totalMonthlySpent}
                        currency="KRW"
                        variant="h5"
                        fontWeight={600}
                        color={totalMonthlySpent <= totalMonthlyBudget ? 'success.main' : 'error.main'}
                      />
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1 }}>
                    <CardContent sx={{ py: 2 }}>
                      <Typography variant="body2" color="textSecondary">잔여</Typography>
                      <AmountText
                        amount={totalMonthlyBudget - totalMonthlySpent}
                        currency="KRW"
                        variant="h5"
                        fontWeight={600}
                        color={totalMonthlyBudget - totalMonthlySpent >= 0 ? 'success.main' : 'error.main'}
                        showSign
                      />
                    </CardContent>
                  </Card>
                </Stack>

                <Box sx={{ height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={budgetItemStats.map(item => ({
                        name: item.name,
                        예산: item.budgetAmount,
                        지출: item.spentAmount,
                        isOverBudget: item.spentAmount > item.budgetAmount,
                      }))}
                      margin={{ top: 5, right: 20, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
                      />
                      <YAxis
                        tickFormatter={(value) => value >= 10000 ? `${(value / 10000).toFixed(0)}만` : value >= 1000 ? `${(value / 1000).toFixed(0)}천` : `${value}`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value.toLocaleString()}원`, name]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar dataKey="예산" fill="#E0E0E0" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="지출" radius={[4, 4, 0, 0]}>
                        {budgetItemStats.map((item) => (
                          <Cell
                            key={item.id}
                            fill={item.spentAmount > item.budgetAmount ? '#FA896B' : item.spentAmount > item.budgetAmount * 0.8 ? '#FFAE1F' : '#13DEB9'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </>
            )}
          </DashboardCard>

          {/* 카테고리별 통계 */}
          <Box sx={{ mt: 3 }}>
            <DashboardCard title="카테고리별 지출">
              {monthlyCategoryStats.length === 0 ? (
                <Typography color="textSecondary" textAlign="center" py={4}>
                  해당 월의 지출 데이터가 없습니다.
                </Typography>
              ) : (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  <Box sx={{ flex: 1, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthlyCategoryStats}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {monthlyCategoryStats.map((entry) => (
                            <Cell key={entry.id} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toLocaleString()}원`, '']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 250 }}>
                    <Stack spacing={1}>
                      {monthlyCategoryStats.map((cat) => (
                        <Stack key={cat.id} direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: cat.color }} />
                            <Typography variant="body2">{cat.name}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={500}>
                            {cat.amount.toLocaleString()}원
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>합계</Typography>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          {monthlyCategoryStats.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}원
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Stack>
              )}
            </DashboardCard>
          </Box>

          {/* 태그별 통계 */}
          {monthlyTagStats.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <DashboardCard title="태그별 지출">
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  <Box sx={{ flex: 1, height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthlyTagStats}
                          dataKey="amount"
                          nameKey="tag"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {monthlyTagStats.map((entry) => (
                            <Cell key={entry.tag} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value.toLocaleString()}원`, '']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 250 }}>
                    <Stack spacing={1}>
                      {monthlyTagStats.map((tagStat) => (
                        <Stack key={tagStat.tag} direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: tagStat.color }} />
                            <Typography variant="body2">{tagStat.tag}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={500}>
                            {tagStat.amount.toLocaleString()}원
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={600}>합계</Typography>
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          {monthlyTagStats.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}원
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Stack>
              </DashboardCard>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
