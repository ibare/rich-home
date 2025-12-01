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
  Tabs,
  Tab,
  LinearProgress,
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
  Treemap,
  PieChart,
  Pie,
} from 'recharts'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'
import AmountText from '../components/shared/AmountText'
import MonthNavigation from '../components/shared/MonthNavigation'

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

// 예산 항목 통계 인터페이스
interface BudgetItemStat {
  id: string
  name: string
  group_name: string | null
  budget_type: string
  budgetAmount: number  // 예산 금액 (KRW 환산)
  spentAmount: number   // 실제 지출 (KRW 환산)
  currency: string
  categories: string[]
}

// 월간 카테고리별 통계 인터페이스
interface MonthlyCategoryStat {
  id: string
  name: string
  amount: number
  color: string
}

// 카테고리별 색상 팔레트
const CATEGORY_COLORS = [
  '#5D87FF', '#13DEB9', '#FFAE1F', '#FA896B', '#49BEFF',
  '#9C27B0', '#4CAF50', '#FF5722', '#607D8B', '#795548',
  '#E91E63', '#00BCD4', '#8BC34A', '#FFC107', '#3F51B5',
]

export default function Statistics() {
  const { setPageTitle, setOnAdd } = usePageContext()

  // 탭 상태
  const [activeTab, setActiveTab] = useState(0)

  // 공통 상태
  const [loading, setLoading] = useState(true)
  const [exchangeRate, setExchangeRate] = useState(385)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // ===== 연간 통계 관련 상태 =====
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [excludedItems, setExcludedItems] = useState<{ month: string; [key: string]: number | string }[]>([])
  const [excludedItemList, setExcludedItemList] = useState<{ name: string; total: number; color: string; enabled: boolean }[]>([])
  const [viewType, setViewType] = useState<'flow' | 'bar'>('flow')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  // 카테고리별 지출 분석 (연간)
  const [treemapData, setTreemapData] = useState<TreemapData[]>([])
  const [categoryList, setCategoryList] = useState<CategoryInfo[]>([])
  // 기간 범위 선택
  const [dateRangeType, setDateRangeType] = useState<'all' | 'custom'>('custom')
  const [fromYear, setFromYear] = useState(new Date().getFullYear())
  const [fromMonth, setFromMonth] = useState(1)
  const [toYear, setToYear] = useState(new Date().getFullYear())
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1)

  // ===== 월간 통계 관련 상태 =====
  const [monthlySelectedYear, setMonthlySelectedYear] = useState(new Date().getFullYear())
  const [monthlySelectedMonth, setMonthlySelectedMonth] = useState(new Date().getMonth() + 1)
  const [budgetItemStats, setBudgetItemStats] = useState<BudgetItemStat[]>([])
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [monthlyCategoryStats, setMonthlyCategoryStats] = useState<MonthlyCategoryStat[]>([])
  const [monthsWithData, setMonthsWithData] = useState<number[]>([])

  useEffect(() => {
    setPageTitle('통계')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

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
      // 환율 조회
      const exchangeRateSetting = (await window.electronAPI.db.query(
        "SELECT value FROM settings WHERE key = 'aed_to_krw_rate'"
      )) as { value: string }[]
      const rate = exchangeRateSetting.length > 0
        ? parseFloat(exchangeRateSetting[0].value)
        : 385
      setExchangeRate(rate)

      // 월별 수입/지출 집계 (통계 포함 거래만)
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
        const amountKRW = row.currency === 'AED' ? row.total * rate : row.total

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

      // 통계 제외 항목 거래내역별 집계
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

      // 거래내역 항목별 총계 계산
      const itemTotals = new Map<string, number>()
      for (const row of excludedResult) {
        const amountKRW = row.currency === 'AED' ? row.total * rate : row.total
        itemTotals.set(row.description, (itemTotals.get(row.description) || 0) + Math.round(amountKRW))
      }

      // 총계 기준 정렬 후 항목 목록 생성
      const sortedItems = Array.from(itemTotals.entries())
        .sort((a, b) => b[1] - a[1])

      // 기존 enabled 상태 유지
      const existingEnabledMap = new Map(excludedItemList.map(item => [item.name, item.enabled]))
      const newExcludedItemList = sortedItems.map(([name, total], index) => ({
        name,
        total,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        enabled: existingEnabledMap.has(name) ? existingEnabledMap.get(name)! : true,
      }))
      setExcludedItemList(newExcludedItemList)

      // 월별 거래내역별 데이터 구조화
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
      // 날짜 범위 계산
      let startDate: string
      let endDate: string

      if (dateRangeType === 'all') {
        startDate = '1900-01-01'
        endDate = '2100-12-31'
      } else {
        startDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-01`
        // 마지막 달의 다음 달 첫날
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

      // 카테고리별 총합 계산
      const categoryTotals = new Map<string, { id: string; name: string; total: number }>()
      result.forEach(row => {
        const amountKRW = row.currency === 'AED' ? row.total * exchangeRate : row.total
        const existing = categoryTotals.get(row.category_id) || { id: row.category_id, name: row.category_name, total: 0 }
        existing.total += amountKRW
        categoryTotals.set(row.category_id, existing)
      })

      // 정렬
      const sortedCategories = Array.from(categoryTotals.values())
        .sort((a, b) => b.total - a.total)

      // 카테고리 목록 업데이트 (기존 enabled 상태 유지)
      const existingEnabledMap = new Map(categoryList.map(c => [c.id, c.enabled]))
      const categories: CategoryInfo[] = sortedCategories.map((cat, index) => ({
        id: cat.id,
        name: cat.name,
        total: Math.round(cat.total),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        enabled: existingEnabledMap.has(cat.id) ? existingEnabledMap.get(cat.id)! : true,
      }))

      // categoryList 변경 시 무한루프 방지
      const hasChanged = categories.length !== categoryList.length ||
        categories.some((c, i) => categoryList[i]?.id !== c.id || categoryList[i]?.total !== c.total)

      if (hasChanged) {
        setCategoryList(categories)
      }

      // Treemap 데이터 생성 (enabled인 카테고리만)
      const enabledCategories = categories.filter(c => c.enabled && c.total > 0)
      const treemap: TreemapData[] = enabledCategories.map(cat => ({
        name: cat.name,
        size: cat.total,
        color: cat.color,
        id: cat.id,
      }))

      setTreemapData(treemap)
    } catch (error) {
      console.error('Failed to load category expense data:', error)
    }
  }

  const handleCategoryToggle = (categoryId: string) => {
    setCategoryList(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    ))
  }

  // ===== 월간 통계 관련 함수들 =====

  // 월간 통계 useEffect
  useEffect(() => {
    if (activeTab === 0) {
      loadMonthlyStatsData()
    }
  }, [activeTab, monthlySelectedYear, monthlySelectedMonth, exchangeRate])

  // 월간 데이터가 있는 월 목록 로드
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
        SELECT bi.id, bi.name, bi.group_name, bi.budget_type, bi.base_amount, bi.currency,
               bi.valid_from, bi.valid_to,
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
        budget_type: string
        base_amount: number
        currency: string
        valid_from: string | null
        valid_to: string | null
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
        // 월 예산 금액 계산
        let budgetAmount = item.base_amount
        if (item.budget_type === 'distributed' && item.valid_from && item.valid_to) {
          const from = new Date(item.valid_from)
          const to = new Date(item.valid_to)
          const monthCount = Math.max(1,
            (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
          )
          budgetAmount = item.base_amount / monthCount
        }

        // KRW 환산
        const budgetAmountKRW = item.currency === 'AED' ? budgetAmount * exchangeRate : budgetAmount

        // 연결된 카테고리들의 지출 합계
        const categoryIds = item.category_ids ? item.category_ids.split(',') : []
        const spentAmount = categoryIds.reduce((sum, catId) => {
          return sum + (categoryExpenseMap.get(catId) || 0)
        }, 0)

        return {
          id: item.id,
          name: item.name,
          group_name: item.group_name,
          budget_type: item.budget_type,
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

      // 카테고리별 합산 (KRW)
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
    } catch (error) {
      console.error('Failed to load monthly stats data:', error)
    } finally {
      setMonthlyLoading(false)
    }
  }

  // ===== 연간 통계 관련 계산 =====

  // 현재까지의 총계
  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0)
  const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0)
  const totalBalance = totalIncome - totalExpense

  // 전월 대비 변화율 (최근 데이터 있는 달 기준)
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

  // 월간 예산 합계
  const totalMonthlyBudget = budgetItemStats.reduce((sum, item) => sum + item.budgetAmount, 0)
  const totalMonthlySpent = budgetItemStats.reduce((sum, item) => sum + item.spentAmount, 0)

  if (loading && activeTab === 1) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="통계 탭"
        >
          <Tab label="월간 통계" />
          <Tab label="연간 통계" />
        </Tabs>
      </Box>

      {/* 월간 통계 탭 */}
      {activeTab === 0 && (
        <Box>
          {/* 월 선택 네비게이션 */}
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
                    {/* 총계 요약 */}
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

                    {/* 예산 항목 리스트 */}
                    <Stack spacing={2}>
                      {budgetItemStats.map((item) => {
                        const percentage = item.budgetAmount > 0 ? Math.min((item.spentAmount / item.budgetAmount) * 100, 150) : 0
                        const isOverBudget = item.spentAmount > item.budgetAmount

                        return (
                          <Card key={item.id} variant="outlined">
                            <CardContent sx={{ py: 2 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography fontWeight={600}>{item.name}</Typography>
                                  {item.group_name && (
                                    <Chip label={item.group_name} size="small" variant="outlined" />
                                  )}
                                </Stack>
                                <Stack direction="row" spacing={2} alignItems="center">
                                  <Stack direction="row" spacing={0.5} alignItems="baseline">
                                    <Typography variant="body2" color="textSecondary">예산:</Typography>
                                    <AmountText amount={item.budgetAmount} currency="KRW" variant="body2" />
                                  </Stack>
                                  <Stack direction="row" spacing={0.5} alignItems="baseline">
                                    <Typography variant="body2" fontWeight={600} color={isOverBudget ? 'error.main' : 'success.main'}>지출:</Typography>
                                    <AmountText amount={item.spentAmount} currency="KRW" variant="body2" fontWeight={600} color={isOverBudget ? 'error.main' : 'success.main'} />
                                  </Stack>
                                </Stack>
                              </Stack>
                              <Box sx={{ position: 'relative' }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(percentage, 100)}
                                  sx={{
                                    height: 10,
                                    borderRadius: 5,
                                    bgcolor: 'grey.200',
                                    '& .MuiLinearProgress-bar': {
                                      bgcolor: isOverBudget ? 'error.main' : percentage > 80 ? 'warning.main' : 'success.main',
                                    },
                                  }}
                                />
                                {isOverBudget && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      right: 0,
                                      top: 0,
                                      height: '100%',
                                      width: `${Math.min((percentage - 100) / 0.5, 50)}%`,
                                      bgcolor: 'error.light',
                                      borderRadius: '0 5px 5px 0',
                                      opacity: 0.5,
                                    }}
                                  />
                                )}
                              </Box>
                              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="textSecondary">
                                  {item.categories.length > 0 ? item.categories.join(', ') : '연결된 카테고리 없음'}
                                </Typography>
                                <Typography variant="caption" fontWeight={500} color={isOverBudget ? 'error.main' : 'textSecondary'}>
                                  {percentage.toFixed(0)}%
                                </Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </Stack>
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
                      {/* 파이 차트 */}
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
                              {monthlyCategoryStats.map((entry, index) => (
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

                      {/* 카테고리 목록 */}
                      <Box sx={{ flex: 1, minWidth: 250 }}>
                        <Stack spacing={1}>
                          {monthlyCategoryStats.map((cat, index) => (
                            <Stack key={cat.id} direction="row" alignItems="center" justifyContent="space-between">
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '2px',
                                    bgcolor: cat.color,
                                  }}
                                />
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
            </>
          )}
        </Box>
      )}

      {/* 연간 통계 탭 */}
      {activeTab === 1 && (
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

      {/* 통계 제외 항목 지출 흐름 (항목별) */}
      {excludedItemList.length > 0 && (
        <Box sx={{ mt: 3 }}>
        <DashboardCard title="통계 제외 항목 지출 흐름">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {/* 차트 */}
            <Box sx={{ flex: 2, height: 380 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={excludedItems}
                  margin={{ top: 40, right: 30, left: 20, bottom: 5 }}
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
                    scale="log"
                    domain={[10000, 'auto']}
                    allowDataOverflow
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => (
                      <span style={{ color: '#5A6A85', fontSize: 11 }}>{value}</span>
                    )}
                  />
                  {excludedItemList.filter(item => item.enabled).map((item) => (
                    <Line
                      key={item.name}
                      type="monotone"
                      dataKey={item.name}
                      name={item.name}
                      stroke={item.color}
                      strokeWidth={2}
                      dot={{ fill: item.color, strokeWidth: 2, r: 4 }}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </Box>

            {/* 항목 선택 */}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                항목 선택
              </Typography>
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
                        sx={{
                          color: item.color,
                          '&.Mui-checked': { color: item.color },
                        }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '2px',
                            bgcolor: item.color,
                          }}
                        />
                        <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.total.toLocaleString()}원
                        </Typography>
                      </Stack>
                    }
                    sx={{ display: 'flex', width: '100%', m: 0, py: 0.5 }}
                  />
                ))}
              </Box>

              {/* 선택된 항목 합계 */}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="textSecondary">
                  선택된 항목 합계
                </Typography>
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
                        height: `${Math.min((data.income / Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)) * 50, 50)}px`,
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
                        height: `${Math.min((data.expense / Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1)) * 50, 50)}px`,
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
        {/* 기간 선택 */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
          <ToggleButtonGroup
            value={dateRangeType}
            exclusive
            onChange={(_, value) => value && setDateRangeType(value)}
            size="small"
          >
            <ToggleButton value="all" sx={{ px: 2 }}>
              전체
            </ToggleButton>
            <ToggleButton value="custom" sx={{ px: 2 }}>
              기간 선택
            </ToggleButton>
          </ToggleButtonGroup>

          {dateRangeType === 'custom' && (
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>시작년</InputLabel>
                <Select
                  value={fromYear}
                  label="시작년"
                  onChange={(e) => setFromYear(e.target.value as number)}
                >
                  {availableYears.map(year => (
                    <MenuItem key={year} value={year}>{year}년</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>월</InputLabel>
                <Select
                  value={fromMonth}
                  label="월"
                  onChange={(e) => setFromMonth(e.target.value as number)}
                >
                  {months.map(month => (
                    <MenuItem key={month} value={month}>{month}월</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography color="textSecondary">~</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>종료년</InputLabel>
                <Select
                  value={toYear}
                  label="종료년"
                  onChange={(e) => setToYear(e.target.value as number)}
                >
                  {availableYears.map(year => (
                    <MenuItem key={year} value={year}>{year}년</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>월</InputLabel>
                <Select
                  value={toMonth}
                  label="월"
                  onChange={(e) => setToMonth(e.target.value as number)}
                >
                  {months.map(month => (
                    <MenuItem key={month} value={month}>{month}월</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </Stack>

        {treemapData.length > 0 ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {/* Treemap */}
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
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          style={{
                            fill: color,
                            stroke: '#fff',
                            strokeWidth: 2,
                          }}
                        />
                        {width > 60 && height > 40 && (
                          <>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 - 8}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={12}
                              fontWeight={600}
                            >
                              {name}
                            </text>
                            <text
                              x={x + width / 2}
                              y={y + height / 2 + 10}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={11}
                            >
                              {displayValue}원
                            </text>
                          </>
                        )}
                      </g>
                    )
                  }}
                />
              </ResponsiveContainer>
            </Box>

            {/* 카테고리 토글 */}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                카테고리 선택
              </Typography>
              <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
                {categoryList.map((cat) => (
                  <FormControlLabel
                    key={cat.id}
                    control={
                      <Checkbox
                        checked={cat.enabled}
                        onChange={() => handleCategoryToggle(cat.id)}
                        size="small"
                        sx={{
                          color: cat.color,
                          '&.Mui-checked': { color: cat.color },
                        }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '2px',
                            bgcolor: cat.color,
                          }}
                        />
                        <Typography variant="body2">
                          {cat.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {cat.total.toLocaleString()}원
                        </Typography>
                      </Stack>
                    }
                    sx={{ display: 'flex', width: '100%', m: 0, py: 0.5 }}
                  />
                ))}
              </Box>

              {/* 선택된 카테고리 총합 */}
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="textSecondary">
                  선택된 카테고리 합계
                </Typography>
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
        </Box>
      )}
    </Box>
  )
}
