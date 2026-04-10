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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
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
  Bar,
  Cell,
  ComposedChart,
  Line,
  Treemap,
  PieChart,
  Pie,
} from 'recharts'
import DashboardCard from '../../components/shared/DashboardCard'
import AmountText from '../../components/shared/AmountText'
import { CATEGORY_COLORS, CHART_COLORS } from '../../../shared/constants'

interface MonthlyData {
  month: string
  monthNum: number
  year: number
  income: number
  expense: number
  balance: number
}

interface TreemapData {
  name: string
  size: number
  color: string
  id: string
}

interface CategoryInfo {
  id: string
  name: string
  total: number
  color: string
  enabled: boolean
}

interface TagStat {
  tag: string
  amount: number
  color: string
}

interface YearlyStatisticsProps {
  exchangeRate: number
}

export default function YearlyStatistics({ exchangeRate }: YearlyStatisticsProps) {
  const [loading, setLoading] = useState(true)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [excludedItems, setExcludedItems] = useState<{ month: string; [key: string]: number | string }[]>([])
  const [excludedItemList, setExcludedItemList] = useState<{ name: string; total: number; color: string; enabled: boolean }[]>([])
  const [viewType, setViewType] = useState<'flow' | 'bar'>('flow')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [treemapData, setTreemapData] = useState<TreemapData[]>([])
  const [categoryList, setCategoryList] = useState<CategoryInfo[]>([])
  const [yearlyTagStats, setYearlyTagStats] = useState<TagStat[]>([])
  const [dateRangeType, setDateRangeType] = useState<'all' | 'custom'>('custom')
  const [fromYear, setFromYear] = useState(new Date().getFullYear())
  const [fromMonth, setFromMonth] = useState(1)
  const [toYear, setToYear] = useState(new Date().getFullYear())
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    loadMonthlyData()
    loadAvailableYears()
  }, [selectedYear])

  useEffect(() => {
    loadCategoryExpenseData()
  }, [dateRangeType, fromYear, fromMonth, toYear, toMonth, exchangeRate, categoryList])

  const loadAvailableYears = async () => {
    try {
      const result = await window.electronAPI.db.query(`
        SELECT DISTINCT CAST(strftime('%Y', date) AS INTEGER) as year
        FROM transactions
        ORDER BY year
      `) as { year: number }[]
      const years = result.map(r => r.year)
      if (years.length > 0) {
        setAvailableYears(years)
      } else {
        setAvailableYears([new Date().getFullYear()])
      }
    } catch (error) {
      console.error('Failed to load available years:', error)
      setAvailableYears([new Date().getFullYear()])
    }
  }

  const loadMonthlyData = async () => {
    setLoading(true)
    try {
      const rate = exchangeRate

      const result = await window.electronAPI.db.query(`
        SELECT
          strftime('%Y', date) as year,
          strftime('%m', date) as month,
          type,
          currency,
          SUM(amount) as total
        FROM transactions
        WHERE strftime('%Y', date) = ?
          AND include_in_stats = 1
        GROUP BY year, month, type, currency
        ORDER BY year, month
      `, [String(selectedYear)]) as {
        year: string
        month: string
        type: string
        currency: string
        total: number
      }[]

      const monthlyMap = new Map<string, { income: number; expense: number }>()
      for (let m = 1; m <= 12; m++) {
        const key = `${selectedYear}-${String(m).padStart(2, '0')}`
        monthlyMap.set(key, { income: 0, expense: 0 })
      }

      for (const row of result) {
        const key = `${row.year}-${row.month}`
        const existing = monthlyMap.get(key) || { income: 0, expense: 0 }
        const amountKRW = row.currency === 'AED' ? row.total * rate : row.total

        if (row.type === 'income') {
          existing.income += amountKRW
        } else {
          existing.expense += amountKRW
        }
        monthlyMap.set(key, existing)
      }

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

      // 통계 제외 항목
      const excludedResult = await window.electronAPI.db.query(`
        SELECT
          strftime('%m', date) as month,
          t.description,
          t.currency,
          SUM(t.amount) as total
        FROM transactions t
        WHERE strftime('%Y', t.date) = ?
          AND t.include_in_stats = 0
          AND t.type = 'expense'
        GROUP BY month, t.description, t.currency
        ORDER BY month, total DESC
      `, [String(selectedYear)]) as {
        month: string
        description: string
        currency: string
        total: number
      }[]

      const itemTotals = new Map<string, number>()
      for (const row of excludedResult) {
        const amountKRW = row.currency === 'AED' ? row.total * rate : row.total
        itemTotals.set(row.description, (itemTotals.get(row.description) || 0) + Math.round(amountKRW))
      }

      const sortedItems = Array.from(itemTotals.entries())
        .sort((a, b) => b[1] - a[1])

      const existingEnabledMap = new Map(excludedItemList.map(item => [item.name, item.enabled]))
      const newExcludedItemList = sortedItems.map(([name, total], index) => ({
        name,
        total,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        enabled: existingEnabledMap.has(name) ? existingEnabledMap.get(name)! : true,
      }))
      setExcludedItemList(newExcludedItemList)

      const excludedMonthlyMap = new Map<string, { [key: string]: number }>()
      for (let m = 1; m <= 12; m++) {
        const key = String(m).padStart(2, '0')
        excludedMonthlyMap.set(key, {})
      }

      for (const row of excludedResult) {
        const existing = excludedMonthlyMap.get(row.month) || {}
        const amountKRW = row.currency === 'AED' ? row.total * rate : row.total
        existing[row.description] = (existing[row.description] || 0) + Math.round(amountKRW)
        excludedMonthlyMap.set(row.month, existing)
      }

      const excludedData: { month: string; [key: string]: number | string }[] = []
      for (let m = 1; m <= 12; m++) {
        const key = String(m).padStart(2, '0')
        const values = excludedMonthlyMap.get(key) || {}
        excludedData.push({
          month: monthNames[m - 1],
          ...values,
        })
      }

      setExcludedItems(excludedData)
    } catch (error) {
      console.error('Failed to load monthly data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategoryExpenseData = async () => {
    try {
      let startDate: string
      let endDate: string

      if (dateRangeType === 'all') {
        startDate = '1900-01-01'
        endDate = '2100-12-31'
      } else {
        startDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`
        if (toMonth === 12) {
          endDate = `${toYear + 1}-01-01`
        } else {
          endDate = `${toYear}-${String(toMonth + 1).padStart(2, '0')}-01`
        }
      }

      const result = await window.electronAPI.db.query(`
        SELECT
          c.id as category_id,
          c.name as category_name,
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
        category_id: string
        category_name: string
        currency: string
        total: number
      }[]

      const categoryTotals = new Map<string, { id: string; name: string; total: number }>()
      result.forEach(row => {
        const amountKRW = row.currency === 'AED' ? row.total * exchangeRate : row.total
        const existing = categoryTotals.get(row.category_id) || { id: row.category_id, name: row.category_name, total: 0 }
        existing.total += amountKRW
        categoryTotals.set(row.category_id, existing)
      })

      const sortedCategories = Array.from(categoryTotals.values())
        .sort((a, b) => b.total - a.total)

      const existingEnabledMap = new Map(categoryList.map(c => [c.id, c.enabled]))
      const categories: CategoryInfo[] = sortedCategories.map((cat, index) => ({
        id: cat.id,
        name: cat.name,
        total: Math.round(cat.total),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        enabled: existingEnabledMap.has(cat.id) ? existingEnabledMap.get(cat.id)! : true,
      }))

      const hasChanged = categories.length !== categoryList.length ||
        categories.some((c, i) => categoryList[i]?.id !== c.id || categoryList[i]?.total !== c.total)

      if (hasChanged) {
        setCategoryList(categories)
      }

      const enabledCategories = categories.filter(c => c.enabled && c.total > 0)
      const treemap: TreemapData[] = enabledCategories.map(cat => ({
        name: cat.name,
        size: cat.total,
        color: cat.color,
        id: cat.id,
      }))

      setTreemapData(treemap)

      // 태그별 지출 통계
      const tagResult = await window.electronAPI.db.query(`
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
      tagResult.forEach(row => {
        const amountKRW = row.currency === 'AED' ? row.total * exchangeRate : row.total
        row.tag.split(',').forEach(t => {
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

      setYearlyTagStats(sortedTagStats)
    } catch (error) {
      console.error('Failed to load category expense data:', error)
    }
  }

  const handleCategoryToggle = (categoryId: string) => {
    setCategoryList(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    ))
  }

  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0)
  const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0)
  const totalBalance = totalIncome - totalExpense

  const lastMonthWithData = monthlyData
    .filter(d => d.income > 0 || d.expense > 0)
    .slice(-1)[0]
  const prevMonthWithData = monthlyData
    .filter(d => d.income > 0 || d.expense > 0)
    .slice(-2, -1)[0]

  const expenseChange = prevMonthWithData && lastMonthWithData && prevMonthWithData.expense > 0
    ? ((lastMonthWithData.expense - prevMonthWithData.expense) / prevMonthWithData.expense) * 100
    : 0

  const colors = CHART_COLORS

  const formatYAxis = (value: number) => {
    if (value >= 100000000) {
      return `${Math.round(value / 100000000).toLocaleString()}억`
    }
    if (value >= 10000) {
      return `${Math.round(value / 10000).toLocaleString()}만`
    }
    return value.toLocaleString()
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
              <Typography variant="body2" color="textSecondary">총 수입</Typography>
              <AmountText amount={totalIncome} currency="KRW" variant="h4" fontWeight={700} color="success.main" />
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="textSecondary">총 지출</Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AmountText amount={totalExpense} currency="KRW" variant="h4" fontWeight={700} color="primary.main" />
                {expenseChange !== 0 && (
                  <Chip
                    icon={expenseChange > 0 ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
                    label={`${Math.abs(expenseChange).toFixed(1)}%`}
                    size="small"
                    sx={{
                      bgcolor: expenseChange > 0 ? 'error.light' : 'success.light',
                      color: expenseChange > 0 ? 'error.main' : 'success.main',
                      fontWeight: 600,
                      '& .MuiChip-icon': { color: 'inherit' },
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
              <Typography variant="body2" color="textSecondary">순수익</Typography>
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
          <ToggleButton value="flow" sx={{ px: 2 }}>흐름 차트</ToggleButton>
          <ToggleButton value="bar" sx={{ px: 2 }}>막대 차트</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* 월별 흐름 차트 */}
      <DashboardCard title="월별 수입/지출 흐름">
        <Box sx={{ height: 400, mt: 2 }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'flow' ? (
              <AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} formatter={(value) => (<span style={{ color: '#5A6A85', fontSize: 12 }}>{value}</span>)} />
                <Area type="monotone" dataKey="income" name="수입" stroke={colors.income} strokeWidth={2} fill="url(#incomeGradient)" />
                <Area type="monotone" dataKey="expense" name="지출" stroke={colors.expense} strokeWidth={2} fill="url(#expenseGradient)" />
              </AreaChart>
            ) : (
              <ComposedChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} formatter={(value) => (<span style={{ color: '#5A6A85', fontSize: 12 }}>{value}</span>)} />
                <Bar dataKey="income" name="수입" fill={colors.income} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name="지출" fill={colors.expense} radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="balance" name="잔액" stroke={colors.balance} strokeWidth={2} dot={{ fill: colors.balance, strokeWidth: 2 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </Box>
      </DashboardCard>

      {/* 통계 제외 항목 */}
      {excludedItemList.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <DashboardCard title="통계 제외 항목 지출 흐름">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 2, height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={excludedItems} margin={{ top: 40, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#5A6A85', fontSize: 12 }} tickFormatter={formatYAxis} scale="log" domain={[10000, 'auto']} allowDataOverflow />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={36} formatter={(value) => (<span style={{ color: '#5A6A85', fontSize: 11 }}>{value}</span>)} />
                    {excludedItemList.filter(item => item.enabled).map((item) => (
                      <Line key={item.name} type="monotone" dataKey={item.name} name={item.name} stroke={item.color} strokeWidth={2} dot={{ fill: item.color, strokeWidth: 2, r: 4 }} connectNulls />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>항목 선택</Typography>
                <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                  {excludedItemList.map((item) => (
                    <FormControlLabel
                      key={item.name}
                      control={
                        <Checkbox
                          checked={item.enabled}
                          onChange={() => setExcludedItemList(prev =>
                            prev.map(i => i.name === item.name ? { ...i, enabled: !i.enabled } : i)
                          )}
                          size="small"
                          sx={{ color: item.color, '&.Mui-checked': { color: item.color } }}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: item.color }} />
                          <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">{item.total.toLocaleString()}원</Typography>
                        </Stack>
                      }
                      sx={{ display: 'flex', width: '100%', m: 0, py: 0.5 }}
                    />
                  ))}
                </Box>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="textSecondary">선택된 항목 합계</Typography>
                  <Typography variant="h5" fontWeight={600} color="primary.main">
                    {excludedItemList.filter(i => i.enabled).reduce((sum, i) => sum + i.total, 0).toLocaleString()}원
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </DashboardCard>
        </Box>
      )}

      {/* 월별 상세 테이블 */}
      <Box sx={{ mt: 3 }}>
        <DashboardCard title="월별 상세">
          <Box sx={{ overflowX: 'auto' }}>
            <Stack direction="row" spacing={0} sx={{ minWidth: 800, py: 2 }}>
              {monthlyData.map((data, index) => {
                const hasData = data.income > 0 || data.expense > 0
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
                    <Typography variant="body2" color="textSecondary" gutterBottom>{data.month}</Typography>
                    <Box sx={{ height: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', mb: 0.5 }}>
                      <Box
                        sx={{
                          width: '70%',
                          height: `${Math.min((data.income / Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)) * 50, 50)}px`,
                          bgcolor: colors.income,
                          borderRadius: '4px 4px 0 0',
                          minHeight: hasData && data.income > 0 ? 4 : 0,
                        }}
                      />
                    </Box>
                    <Box sx={{ height: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', mt: 0.5 }}>
                      <Box
                        sx={{
                          width: '70%',
                          height: `${Math.min((data.expense / Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)) * 50, 50)}px`,
                          bgcolor: colors.expense,
                          borderRadius: '0 0 4px 4px',
                          minHeight: hasData && data.expense > 0 ? 4 : 0,
                        }}
                      />
                    </Box>
                    {hasData && (
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: colors.income, fontWeight: 600 }}>
                          +{Math.round(data.income / 10000).toLocaleString()}만
                        </Typography>
                        <Typography variant="caption" sx={{ color: colors.expense, fontWeight: 600 }}>
                          -{Math.round(data.expense / 10000).toLocaleString()}만
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

      {/* 카테고리별 지출 분석 */}
      <Box sx={{ mt: 3 }}>
        <DashboardCard title="카테고리별 지출 분석">
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
            <ToggleButtonGroup
              value={dateRangeType}
              exclusive
              onChange={(_, value) => value && setDateRangeType(value)}
              size="small"
            >
              <ToggleButton value="all" sx={{ px: 2 }}>전체</ToggleButton>
              <ToggleButton value="custom" sx={{ px: 2 }}>기간 선택</ToggleButton>
            </ToggleButtonGroup>

            {dateRangeType === 'custom' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <InputLabel>시작년</InputLabel>
                  <Select value={fromYear} label="시작년" onChange={(e) => setFromYear(e.target.value as number)}>
                    {availableYears.map(year => (<MenuItem key={year} value={year}>{year}년</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 70 }}>
                  <InputLabel>월</InputLabel>
                  <Select value={fromMonth} label="월" onChange={(e) => setFromMonth(e.target.value as number)}>
                    {months.map(month => (<MenuItem key={month} value={month}>{month}월</MenuItem>))}
                  </Select>
                </FormControl>
                <Typography color="textSecondary">~</Typography>
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <InputLabel>종료년</InputLabel>
                  <Select value={toYear} label="종료년" onChange={(e) => setToYear(e.target.value as number)}>
                    {availableYears.map(year => (<MenuItem key={year} value={year}>{year}년</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 70 }}>
                  <InputLabel>월</InputLabel>
                  <Select value={toMonth} label="월" onChange={(e) => setToMonth(e.target.value as number)}>
                    {months.map(month => (<MenuItem key={month} value={month}>{month}월</MenuItem>))}
                  </Select>
                </FormControl>
              </Stack>
            )}
          </Stack>

          {treemapData.length > 0 ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 2, height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    content={({ x, y, width, height, name, value, color }: any) => {
                      if (width < 30 || height < 30) return null
                      const displayValue = value >= 10000
                        ? `${(value / 10000).toFixed(0)}만`
                        : `${(value / 1000).toFixed(0)}천`
                      return (
                        <g>
                          <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 2 }} />
                          {width > 60 && height > 40 && (
                            <>
                              <text x={x + width / 2} y={y + height / 2 - 8} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>{name}</text>
                              <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="#fff" fontSize={11}>{displayValue}원</text>
                            </>
                          )}
                        </g>
                      )
                    }}
                  />
                </ResponsiveContainer>
              </Box>

              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>카테고리 선택</Typography>
                <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                  {categoryList.map((cat) => (
                    <FormControlLabel
                      key={cat.id}
                      control={
                        <Checkbox
                          checked={cat.enabled}
                          onChange={() => handleCategoryToggle(cat.id)}
                          size="small"
                          sx={{ color: cat.color, '&.Mui-checked': { color: cat.color } }}
                        />
                      }
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: cat.color }} />
                          <Typography variant="body2">{cat.name}</Typography>
                          <Typography variant="caption" color="textSecondary">{cat.total.toLocaleString()}원</Typography>
                        </Stack>
                      }
                      sx={{ display: 'flex', width: '100%', m: 0, py: 0.5 }}
                    />
                  ))}
                </Box>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="textSecondary">선택된 카테고리 합계</Typography>
                  <Typography variant="h5" fontWeight={600} color="primary.main">
                    {categoryList.filter(c => c.enabled).reduce((sum, c) => sum + c.total, 0).toLocaleString()}원
                  </Typography>
                </Box>
              </Box>
            </Stack>
          ) : (
            <Typography color="textSecondary" textAlign="center" py={4}>
              해당 기간의 지출 데이터가 없습니다.
            </Typography>
          )}
        </DashboardCard>
      </Box>

      {/* 태그별 지출 분석 */}
      {yearlyTagStats.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <DashboardCard title="태그별 지출 분석">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
              <Box sx={{ flex: 1, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={yearlyTagStats} dataKey="amount" nameKey="tag" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                      {yearlyTagStats.map((entry) => (<Cell key={entry.tag} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toLocaleString()}원`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <Box sx={{ flex: 1, minWidth: 250 }}>
                <Stack spacing={1}>
                  {yearlyTagStats.map((tagStat) => (
                    <Stack key={tagStat.tag} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: tagStat.color }} />
                        <Typography variant="body2">{tagStat.tag}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={500}>{tagStat.amount.toLocaleString()}원</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>합계</Typography>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {yearlyTagStats.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}원
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </DashboardCard>
        </Box>
      )}
    </Box>
  )
}
