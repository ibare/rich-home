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
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { IconTrash, IconPlus, IconCalendarPlus, IconEdit } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import TransactionModal from '../components/modals/TransactionModal'
import BudgetItemModal from '../components/modals/BudgetItemModal'
import AmountText from '../components/shared/AmountText'
import MonthNavigation from '../components/shared/MonthNavigation'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_id: string
  category_name: string
  budget_item_id: string | null
  budget_item_name: string | null
  budget_group_name: string | null
  date: string
  description: string | null
  memo: string | null
  include_in_stats: number
}

interface BudgetSummary {
  group_name: string
  budget_amount: number
  spent_amount: number
}

interface BudgetItem {
  id: string
  name: string
  group_name: string | null
}

export default function Transactions() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([])
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [budgetItemModalOpen, setBudgetItemModalOpen] = useState(false)
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState(385) // AED to KRW
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

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
    loadBudgetSummaries()
    setSelectedGroups(new Set()) // 월 변경 시 선택 초기화
  }, [selectedYear, selectedMonth, exchangeRate])

  useEffect(() => {
    loadBudgetItems()
    loadExchangeRate()
  }, [])

  // 환율 조회
  const loadExchangeRate = async () => {
    try {
      const result = (await window.electronAPI.db.query(
        `SELECT value FROM settings WHERE key = 'exchange_rate'`
      )) as { value: string }[]
      if (result.length > 0) {
        setExchangeRate(parseFloat(result[0].value))
      }
    } catch (error) {
      console.error('Failed to load exchange rate:', error)
    }
  }

  // 예산 항목 목록 조회
  const loadBudgetItems = async () => {
    try {
      const result = await window.electronAPI.db.query(
        `SELECT id, name, group_name FROM budget_items WHERE is_active = 1 ORDER BY sort_order`
      )
      setBudgetItems(result as BudgetItem[])
    } catch (error) {
      console.error('Failed to load budget items:', error)
    }
  }

  // 예산 그룹 선택 토글
  const toggleGroupSelection = (groupName: string) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
      }
      return newSet
    })
  }

  // 선택된 그룹에 따른 거래내역 필터링
  const filteredTransactions = selectedGroups.size === 0
    ? transactions
    : transactions.filter((t) => {
        const groupName = t.budget_group_name || '미분류'
        return selectedGroups.has(groupName)
      })

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
        SELECT t.*, c.name as category_name,
          (SELECT bi.id FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = c.id
           LIMIT 1) as budget_item_id,
          (SELECT bi.name FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = c.id
           LIMIT 1) as budget_item_name,
          (SELECT COALESCE(bi.group_name, '미분류') FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = c.id
           LIMIT 1) as budget_group_name
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

  // 예산 그룹별 지출 집계 조회
  const loadBudgetSummaries = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 예산 그룹별로 집계 (group_name 기준)
      // 환율을 적용하여 모든 금액을 KRW로 환산
      // distributed 예산은 기간 기반 월 분배액 계산
      // 지출은 그룹 내 모든 카테고리에서 DISTINCT하게 집계 (중복 방지)
      const budgetQuery = `
        SELECT
          COALESCE(bi.group_name, '미분류') as group_name,
          SUM(
            CASE
              WHEN bi.budget_type = 'distributed' AND bi.valid_from IS NOT NULL AND bi.valid_to IS NOT NULL THEN
                CASE WHEN bi.currency = 'AED'
                  THEN ROUND(bi.base_amount / MAX(1, (
                    (CAST(strftime('%Y', bi.valid_to) AS INTEGER) - CAST(strftime('%Y', bi.valid_from) AS INTEGER)) * 12 +
                    (CAST(strftime('%m', bi.valid_to) AS INTEGER) - CAST(strftime('%m', bi.valid_from) AS INTEGER)) + 1
                  ))) * ?
                  ELSE ROUND(bi.base_amount / MAX(1, (
                    (CAST(strftime('%Y', bi.valid_to) AS INTEGER) - CAST(strftime('%Y', bi.valid_from) AS INTEGER)) * 12 +
                    (CAST(strftime('%m', bi.valid_to) AS INTEGER) - CAST(strftime('%m', bi.valid_from) AS INTEGER)) + 1
                  )))
                END
              ELSE
                CASE WHEN bi.currency = 'AED'
                  THEN bi.base_amount * ?
                  ELSE bi.base_amount
                END
            END
          ) as budget_amount
        FROM budget_items bi
        WHERE bi.is_active = 1
          AND (
            bi.budget_type != 'distributed'
            OR (bi.valid_from < ? AND bi.valid_to >= ?)
          )
        GROUP BY COALESCE(bi.group_name, '미분류')
        ORDER BY bi.group_name
      `

      const budgetResult = await window.electronAPI.db.query(budgetQuery, [
        exchangeRate,
        exchangeRate,
        endDate,
        startDate,
      ]) as { group_name: string; budget_amount: number }[]

      // 그룹별 지출 집계 (그룹 내 모든 카테고리의 거래를 DISTINCT하게)
      // 같은 거래가 여러 예산 항목에 연결된 카테고리에 있을 수 있으므로 거래 ID로 중복 제거
      const spentQuery = `
        SELECT
          group_name,
          COALESCE(SUM(amount_krw), 0) as spent_amount
        FROM (
          SELECT DISTINCT
            t.id,
            COALESCE(bi.group_name, '미분류') as group_name,
            CASE WHEN t.currency = 'AED'
              THEN t.amount * ?
              ELSE t.amount
            END as amount_krw
          FROM transactions t
          JOIN budget_item_categories bic ON t.category_id = bic.category_id
          JOIN budget_items bi ON bic.budget_item_id = bi.id
          WHERE bi.is_active = 1
            AND (
              bi.budget_type != 'distributed'
              OR (bi.valid_from < ? AND bi.valid_to >= ?)
            )
            AND t.date >= ?
            AND t.date < ?
            AND t.type = 'expense'
            AND t.include_in_stats = 1
        )
        GROUP BY group_name
      `

      const spentResult = await window.electronAPI.db.query(spentQuery, [
        exchangeRate,
        endDate,
        startDate,
        startDate,
        endDate,
      ]) as { group_name: string; spent_amount: number }[]

      // 결과 병합
      const spentMap = new Map(spentResult.map(r => [r.group_name, r.spent_amount]))
      const result = budgetResult.map(b => ({
        group_name: b.group_name,
        budget_amount: b.budget_amount,
        spent_amount: spentMap.get(b.group_name) || 0,
      }))
      setBudgetSummaries(result as BudgetSummary[])
    } catch (error) {
      console.error('Failed to load budget summaries:', error)
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
      loadBudgetSummaries()
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

  // 합계 계산 (통계 포함 거래만)
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && t.include_in_stats === 1)
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense' && t.include_in_stats === 1)
    .reduce((sum, t) => sum + t.amount, 0)

  const handleSaved = () => {
    loadTransactions()
    loadMonthsWithData()
    loadBudgetSummaries()
  }

  // 예산 항목 변경 처리
  const handleBudgetItemChange = async (categoryId: string, budgetItemId: string | null) => {
    try {
      // 기존 매핑 삭제
      await window.electronAPI.db.query(
        `DELETE FROM budget_item_categories WHERE category_id = ?`,
        [categoryId]
      )

      // 새로운 매핑 추가 (선택한 경우)
      if (budgetItemId) {
        const { v4: uuidv4 } = await import('uuid')
        await window.electronAPI.db.query(
          `INSERT INTO budget_item_categories (id, budget_item_id, category_id) VALUES (?, ?, ?)`,
          [uuidv4(), budgetItemId, categoryId]
        )
      }

      // 데이터 새로고침
      loadTransactions()
      loadBudgetSummaries()
    } catch (error) {
      console.error('Failed to change budget item:', error)
      alert('예산 항목 변경에 실패했습니다.')
    }
  }

  // 예산 항목 생성 후 콜백
  const handleBudgetItemCreated = () => {
    loadBudgetItems()
    if (pendingCategoryId) {
      // 새로 생성된 예산 항목을 자동으로 선택하려면 추가 로직 필요
      // 일단은 목록만 새로고침
      loadTransactions()
      loadBudgetSummaries()
    }
    setPendingCategoryId(null)
  }

  // 분배 예산 거래 자동 생성
  const generateDistributedTransactions = async () => {
    try {
      // 선택된 월의 첫째 날 (유효 기간 비교용)
      const targetMonthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const targetMonthEnd = selectedMonth === 12
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 분배 예산 항목 조회 (유효 기간 내)
      const distributedBudgets = (await window.electronAPI.db.query(`
        SELECT
          bi.id,
          bi.name,
          bi.budget_type,
          bi.base_amount,
          bi.currency,
          bi.valid_from,
          bi.valid_to,
          (SELECT bic.category_id FROM budget_item_categories bic WHERE bic.budget_item_id = bi.id LIMIT 1) as category_id
        FROM budget_items bi
        WHERE bi.is_active = 1
          AND bi.budget_type = 'distributed'
          AND bi.valid_from IS NOT NULL
          AND bi.valid_to IS NOT NULL
          AND bi.valid_from < ?
          AND bi.valid_to >= ?
      `, [targetMonthEnd, targetMonthStart])) as {
        id: string
        name: string
        budget_type: string
        base_amount: number
        currency: string
        valid_from: string
        valid_to: string
        category_id: string | null
      }[]

      if (distributedBudgets.length === 0) {
        alert('생성할 분배 예산 항목이 없습니다. (유효 기간 확인)')
        return
      }

      // 이미 생성된 거래가 있는지 확인
      const existingCount = (await window.electronAPI.db.get(`
        SELECT COUNT(*) as count FROM transactions
        WHERE date >= ? AND date < ?
          AND description LIKE '[분배]%'
      `, [targetMonthStart, targetMonthEnd])) as { count: number }

      if (existingCount.count > 0) {
        if (!confirm(`이미 ${existingCount.count}건의 분배 거래가 있습니다. 추가로 생성하시겠습니까?`)) {
          return
        }
      }

      // 거래 생성
      const { v4: uuidv4 } = await import('uuid')
      let createdCount = 0
      let skippedCount = 0

      // 월 수 계산 함수
      const calcMonths = (from: string, to: string) => {
        const fromDate = new Date(from)
        const toDate = new Date(to)
        const months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth()) + 1
        return Math.max(1, months)
      }

      for (const budget of distributedBudgets) {
        if (!budget.category_id) {
          console.warn(`예산 항목 "${budget.name}"에 연결된 카테고리가 없습니다.`)
          skippedCount++
          continue
        }

        const months = calcMonths(budget.valid_from, budget.valid_to)
        const monthlyAmount = Math.round(budget.base_amount / months)

        await window.electronAPI.db.query(`
          INSERT INTO transactions (id, type, amount, currency, category_id, date, description, include_in_stats)
          VALUES (?, 'expense', ?, ?, ?, ?, ?, 1)
        `, [
          uuidv4(),
          monthlyAmount,
          budget.currency,
          budget.category_id,
          targetMonthStart,
          `[분배] ${budget.name} (${months}개월)`
        ])
        createdCount++
      }

      const message = skippedCount > 0
        ? `${createdCount}건의 분배 거래가 생성되었습니다. (${skippedCount}건 스킵: 카테고리 미연결)`
        : `${createdCount}건의 분배 거래가 생성되었습니다.`
      alert(message)
      loadTransactions()
      loadMonthsWithData()
      loadBudgetSummaries()
    } catch (error) {
      console.error('Failed to generate distributed transactions:', error)
      alert('분배 거래 생성에 실패했습니다.')
    }
  }

  // DataGrid 컬럼 정의
  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: '날짜',
      width: 120,
      renderCell: (params: GridRenderCellParams<Transaction>) => formatDate(params.value),
    },
    {
      field: 'type',
      headerName: '구분',
      width: 80,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <Chip
          label={params.value === 'expense' ? '지출' : '수입'}
          size="small"
          color={params.value === 'expense' ? 'error' : 'success'}
          sx={{ '& .MuiChip-label': { fontSize: '0.95em' }, height: 26, minWidth: 50 }}
        />
      ),
    },
    {
      field: 'description',
      headerName: '내용',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">
            {params.value || params.row.category_name}
          </Typography>
          {params.row.include_in_stats === 0 && (
            <Chip
              label="통계 제외"
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Stack>
      ),
    },
    {
      field: 'category_name',
      headerName: '카테고리',
      width: 130,
    },
    {
      field: 'budget_item_name',
      headerName: '예산 항목',
      width: 160,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <FormControl size="small" fullWidth>
          <Select
            value={params.row.budget_item_id || ''}
            onChange={(e) => {
              const value = e.target.value
              if (value === '__create__') {
                setPendingCategoryId(params.row.category_id)
                setBudgetItemModalOpen(true)
              } else {
                handleBudgetItemChange(params.row.category_id, value || null)
              }
            }}
            displayEmpty
            sx={{
              fontSize: '0.875rem',
              '& .MuiSelect-select': { py: 0.5 },
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                border: '1px solid',
                borderColor: 'divider',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                border: '1px solid',
                borderColor: 'primary.main',
              },
            }}
          >
            <MenuItem value="">
              <Typography variant="body2" color="text.disabled">미지정</Typography>
            </MenuItem>
            {budgetItems.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
              </MenuItem>
            ))}
            <MenuItem value="__create__" sx={{ borderTop: 1, borderColor: 'divider', mt: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconPlus size={16} />
                <Typography variant="body2">새 예산 항목 추가</Typography>
              </Stack>
            </MenuItem>
          </Select>
        </FormControl>
      ),
    },
    {
      field: 'amount',
      headerName: '금액',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <AmountText
          amount={params.value}
          currency={params.row.currency}
          variant="body2"
          fontWeight={600}
          color={params.row.type === 'expense' ? 'error.main' : 'success.main'}
          showSign
          signType={params.row.type}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              setEditingTransaction(params.row)
              setModalOpen(true)
            }}
          >
            <IconEdit size={16} />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              setDeletingId(params.row.id)
              setDeleteConfirmOpen(true)
            }}
          >
            <IconTrash size={16} />
          </IconButton>
        </Stack>
      ),
    },
  ]

  return (
    <Box>
      <MonthNavigation
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        monthsWithData={monthsWithData}
        actionSlot={
          <Button
            size="small"
            startIcon={<IconCalendarPlus size={16} />}
            onClick={generateDistributedTransactions}
            variant="outlined"
          >
            분배 거래 생성
          </Button>
        }
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

      {/* 예산별 집계 */}
      {budgetSummaries.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            예산 그룹별 지출
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {budgetSummaries.map((budget) => {
              const isOverBudget = budget.spent_amount > budget.budget_amount
              const overAmount = budget.spent_amount - budget.budget_amount
              const withinBudgetPercent = budget.budget_amount > 0
                ? Math.min((budget.spent_amount / budget.budget_amount) * 100, 100)
                : 0
              const overBudgetPercent = isOverBudget && budget.budget_amount > 0
                ? Math.min((overAmount / budget.budget_amount) * 100, 50)
                : 0
              const isSelected = selectedGroups.has(budget.group_name)
              return (
                <Card
                  key={budget.group_name}
                  onClick={() => toggleGroupSelection(budget.group_name)}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: 2,
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    bgcolor: isSelected ? 'primary.50' : 'background.paper',
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'grey.300',
                    },
                  }}
                >
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="body1" fontWeight={600}>
                        {budget.group_name}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          width: 100,
                          height: 16,
                          borderRadius: 8,
                          overflow: 'hidden',
                          bgcolor: 'grey.200',
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: `${withinBudgetPercent}%`,
                            bgcolor: 'success.main',
                            transition: 'width 0.3s',
                          }}
                        />
                        {isOverBudget && (
                          <Box
                            sx={{
                              width: `${overBudgetPercent}%`,
                              bgcolor: 'error.main',
                              transition: 'width 0.3s',
                            }}
                          />
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" alignItems="baseline" spacing={0.5}>
                      <Typography variant="h6" fontWeight={600}>
                        {Math.round(budget.spent_amount).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        원
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        / {Math.round(budget.budget_amount).toLocaleString()}원
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Box>
        </Box>
      )}

      {/* 거래 목록 DataGrid */}
      <DataGrid
        rows={filteredTransactions}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        hideFooter
        initialState={{
          sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
        }}
        getRowClassName={(params) =>
          params.row.include_in_stats === 0 ? 'row-excluded' : ''
        }
        sx={{
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
          },
          '& .row-excluded': {
            opacity: 0.6,
          },
          '& .MuiDataGrid-columnHeaders': {
            bgcolor: 'background.default',
            borderBottom: '2px solid',
            borderColor: 'divider',
          },
        }}
        localeText={{
          noRowsLabel: '이번 달 거래 내역이 없습니다.',
        }}
        autoHeight
      />

      <TransactionModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTransaction(null)
        }}
        onSaved={handleSaved}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        editTransaction={editingTransaction}
      />

      <BudgetItemModal
        open={budgetItemModalOpen}
        onClose={() => {
          setBudgetItemModalOpen(false)
          setPendingCategoryId(null)
        }}
        onSaved={handleBudgetItemCreated}
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
