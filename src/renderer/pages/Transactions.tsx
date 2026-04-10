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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { IconTrash, IconCalendarPlus, IconEdit } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import TransactionModal from '../components/modals/TransactionModal'
import BudgetItemModal from '../components/modals/BudgetItemModal'
import AmountText from '../components/shared/AmountText'
import CategoryPicker from '../components/shared/CategoryPicker'
import MonthNavigation from '../components/shared/MonthNavigation'
import { STORAGE_KEYS } from '../../shared/constants'
import { useExchangeRate } from '../hooks/useExchangeRate'

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
  tag: string | null
}

interface BudgetSummary {
  budget_item_id: string
  budget_item_name: string
  budget_amount: number
  spent_amount: number
  category_names: string
}

export default function Transactions() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const { exchangeRate } = useExchangeRate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<string | null>(null)
  const [selectedBudgetCategoryIds, setSelectedBudgetCategoryIds] = useState<string[]>([])
  const [budgetDisplayCurrency, setBudgetDisplayCurrency] = useState<'KRW' | 'AED'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGET_DISPLAY_CURRENCY)
    return (saved === 'AED' || saved === 'KRW') ? saved : 'KRW'
  })
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [budgetItemModalOpen, setBudgetItemModalOpen] = useState(false)
  const [editingBudgetItem, setEditingBudgetItem] = useState<{ id: string; name: string; group_name: string | null; base_amount: number; currency: string; memo: string | null } | null>(null)
  const [categoryPickerAnchor, setCategoryPickerAnchor] = useState<HTMLElement | null>(null)
  const [categoryPickerTransaction, setCategoryPickerTransaction] = useState<Transaction | null>(null)

  // 필터 - localStorage에서 마지막 선택한 년월 불러오기
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS_YEAR)
    return saved ? parseInt(saved, 10) : new Date().getFullYear()
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS_MONTH)
    return saved ? parseInt(saved, 10) : new Date().getMonth() + 1
  })

  // 년월 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS_YEAR, String(selectedYear))
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS_MONTH, String(selectedMonth))
  }, [selectedYear, selectedMonth])

  // 예산 표시 화폐 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDGET_DISPLAY_CURRENCY, budgetDisplayCurrency)
  }, [budgetDisplayCurrency])

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
    setSelectedBudgetItem(null) // 월 변경 시 선택 초기화
    setSelectedBudgetCategoryIds([])
  }, [selectedYear, selectedMonth, exchangeRate])


  // 예산 항목 선택 토글 (단일 선택)
  const toggleBudgetItemSelection = async (budgetItemId: string) => {
    if (selectedBudgetItem === budgetItemId) {
      // 선택 해제
      setSelectedBudgetItem(null)
      setSelectedBudgetCategoryIds([])
    } else {
      // 선택: 해당 예산에 연결된 카테고리 ID들 조회
      try {
        const result = await window.electronAPI.db.query(
          'SELECT category_id FROM budget_item_categories WHERE budget_item_id = ?',
          [budgetItemId]
        ) as { category_id: string }[]
        setSelectedBudgetItem(budgetItemId)
        setSelectedBudgetCategoryIds(result.map(r => r.category_id))
      } catch (error) {
        console.error('Failed to load budget categories:', error)
      }
    }
  }

  // 선택된 예산 항목에 따른 거래내역 필터링 (카테고리 기반)
  const filteredTransactions = selectedBudgetItem === null
    ? transactions
    : transactions.filter((t) => selectedBudgetCategoryIds.includes(t.category_id))

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
        SELECT t.*, COALESCE(c.name, '(카테고리 없음)') as category_name,
          (SELECT bi.id FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = t.category_id
           LIMIT 1) as budget_item_id,
          (SELECT bi.name FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = t.category_id
           LIMIT 1) as budget_item_name,
          (SELECT COALESCE(bi.group_name, '미분류') FROM budget_item_categories bic
           JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
           WHERE bic.category_id = t.category_id
           LIMIT 1) as budget_group_name
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
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

  // 예산 항목별 지출 집계 조회
  const loadBudgetSummaries = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 예산 항목별로 집계
      // 환율을 적용하여 모든 금액을 KRW로 환산
      const budgetQuery = `
        SELECT
          bi.id as budget_item_id,
          bi.name as budget_item_name,
          CASE WHEN bi.currency = 'AED'
            THEN bi.base_amount * ?
            ELSE bi.base_amount
          END as budget_amount,
          COALESCE(GROUP_CONCAT(c.name, ', '), '') as category_names
        FROM budget_items bi
        LEFT JOIN budget_item_categories bic ON bic.budget_item_id = bi.id
        LEFT JOIN categories c ON c.id = bic.category_id
        WHERE bi.is_active = 1
        GROUP BY bi.id
        ORDER BY bi.sort_order
      `

      const budgetResult = await window.electronAPI.db.query(budgetQuery, [
        exchangeRate,
      ]) as { budget_item_id: string; budget_item_name: string; budget_amount: number; category_names: string }[]

      // 예산 항목별 지출 집계
      const spentQuery = `
        SELECT
          bi.id as budget_item_id,
          COALESCE(SUM(
            CASE WHEN t.currency = 'AED'
              THEN t.amount * ?
              ELSE t.amount
            END
          ), 0) as spent_amount
        FROM budget_items bi
        LEFT JOIN budget_item_categories bic ON bic.budget_item_id = bi.id
        LEFT JOIN transactions t ON t.category_id = bic.category_id
          AND t.date >= ?
          AND t.date < ?
          AND t.type = 'expense'
          AND t.include_in_stats = 1
        WHERE bi.is_active = 1
        GROUP BY bi.id
      `

      const spentResult = await window.electronAPI.db.query(spentQuery, [
        exchangeRate,
        startDate,
        endDate,
      ]) as { budget_item_id: string; spent_amount: number }[]

      // 결과 병합
      const spentMap = new Map(spentResult.map(r => [r.budget_item_id, r.spent_amount]))
      const result = budgetResult.map(b => ({
        budget_item_id: b.budget_item_id,
        budget_item_name: b.budget_item_name,
        budget_amount: b.budget_amount,
        spent_amount: spentMap.get(b.budget_item_id) || 0,
        category_names: b.category_names,
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

  // 합계 계산 (통계 포함 거래만, AED는 KRW로 환산)
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && t.include_in_stats === 1)
    .reduce((sum, t) => sum + (t.currency === 'AED' ? t.amount * exchangeRate : t.amount), 0)
  const totalExpense = transactions
    .filter((t) => t.type === 'expense' && t.include_in_stats === 1)
    .reduce((sum, t) => sum + (t.currency === 'AED' ? t.amount * exchangeRate : t.amount), 0)

  const handleBudgetCardDoubleClick = async (budgetItemId: string) => {
    try {
      const result = await window.electronAPI.db.get(
        'SELECT id, name, group_name, base_amount, currency, memo FROM budget_items WHERE id = ?',
        [budgetItemId]
      ) as { id: string; name: string; group_name: string | null; base_amount: number; currency: string; memo: string | null } | undefined
      if (result) {
        setEditingBudgetItem(result)
        setBudgetItemModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to load budget item:', error)
    }
  }

  const handleCategoryChange = async (transactionId: string, newCategoryId: string) => {
    try {
      await window.electronAPI.db.query(
        `UPDATE transactions SET category_id = ?, updated_at = datetime('now') WHERE id = ?`,
        [newCategoryId, transactionId]
      )
      loadTransactions()
      loadBudgetSummaries()
    } catch (error) {
      console.error('Failed to update transaction category:', error)
    }
  }

  const handleSaved = () => {
    loadTransactions()
    loadMonthsWithData()
    loadBudgetSummaries()
  }

  // 자동 거래 생성 (auto_transaction_rules 테이블 기반)
  const generateDistributedTransactions = async () => {
    try {
      const targetMonthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const targetMonthEnd = selectedMonth === 12
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 자동 거래 규칙 조회
      const rules = (await window.electronAPI.db.query(`
        SELECT atr.id, atr.name, atr.rule_type, atr.base_amount, atr.currency,
               atr.valid_from, atr.valid_to, atr.account_id, atr.category_id
        FROM auto_transaction_rules atr
        WHERE atr.is_active = 1 AND (
          atr.rule_type = 'fixed_monthly'
          OR (atr.rule_type = 'distributed' AND atr.valid_from < ? AND atr.valid_to >= ?)
        )
      `, [targetMonthEnd, targetMonthStart])) as {
        id: string
        name: string
        rule_type: string
        base_amount: number
        currency: string
        valid_from: string | null
        valid_to: string | null
        account_id: string | null
        category_id: string | null
      }[]

      if (rules.length === 0) {
        alert('생성할 자동 거래 규칙이 없습니다.')
        return
      }

      const { v4: uuidv4 } = await import('uuid')
      let createdCount = 0

      const calcMonths = (from: string, to: string) => {
        const fromDate = new Date(from)
        const toDate = new Date(to)
        const months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth()) + 1
        return Math.max(1, months)
      }

      for (const rule of rules) {
        if (!rule.category_id) {
          console.warn(`자동 거래 규칙 "${rule.name}"에 연결된 카테고리가 없습니다.`)
          continue
        }

        let description: string
        let monthlyAmount: number

        if (rule.rule_type === 'distributed') {
          const months = calcMonths(rule.valid_from!, rule.valid_to!)
          description = `[분배] ${rule.name} (${months}개월)`
          monthlyAmount = Math.round(rule.base_amount / months)
        } else {
          description = rule.account_id
            ? `[고정] ${rule.name} 🐷`
            : `[고정] ${rule.name}`
          monthlyAmount = rule.base_amount
        }

        // 동일한 내용의 거래가 이미 있는지 확인
        const existing = (await window.electronAPI.db.get(`
          SELECT COUNT(*) as count FROM transactions
          WHERE date >= ? AND date < ?
            AND description = ?
        `, [targetMonthStart, targetMonthEnd, description])) as { count: number }

        if (existing.count > 0) {
          continue
        }

        await window.electronAPI.db.query(`
          INSERT INTO transactions (id, type, amount, currency, category_id, date, description, include_in_stats)
          VALUES (?, 'expense', ?, ?, ?, ?, ?, 1)
        `, [
          uuidv4(),
          monthlyAmount,
          rule.currency,
          rule.category_id,
          targetMonthStart,
          description
        ])

        // 고정 규칙에 계좌가 연결되어 있으면 해당 계좌 잔고에 금액 합산
        if (rule.rule_type === 'fixed_monthly' && rule.account_id) {
          // 1) recorded_at 결정: 거래 대상 월에 이미 잔고 기록이 있으면 마지막 기록 +1일,
          //    없으면 그달의 1일 — 항상 대상 월 안에 위치하도록 보장
          const lastInMonth = (await window.electronAPI.db.get(`
            SELECT recorded_at FROM account_balances
            WHERE account_id = ?
              AND recorded_at >= ?
              AND recorded_at < ?
            ORDER BY recorded_at DESC, created_at DESC
            LIMIT 1
          `, [rule.account_id, targetMonthStart, targetMonthEnd])) as { recorded_at: string } | undefined

          let balanceRecordedAt: string
          if (lastInMonth?.recorded_at) {
            const latestDate = new Date(lastInMonth.recorded_at)
            latestDate.setDate(latestDate.getDate() + 1)
            const y = latestDate.getFullYear()
            const m = String(latestDate.getMonth() + 1).padStart(2, '0')
            const d = String(latestDate.getDate()).padStart(2, '0')
            const hh = String(latestDate.getHours()).padStart(2, '0')
            const mm = String(latestDate.getMinutes()).padStart(2, '0')
            const ss = String(latestDate.getSeconds()).padStart(2, '0')
            balanceRecordedAt = `${y}-${m}-${d} ${hh}:${mm}:${ss}`
          } else {
            balanceRecordedAt = `${targetMonthStart} 00:00:00`
          }

          // 2) 새 기록 시점 직전의 잔고를 base로 사용 (현재 최신 잔고가 아닌 시점 기준)
          const baseRecord = (await window.electronAPI.db.get(`
            SELECT balance FROM account_balances
            WHERE account_id = ?
              AND recorded_at < ?
            ORDER BY recorded_at DESC, created_at DESC
            LIMIT 1
          `, [rule.account_id, balanceRecordedAt])) as { balance: number } | undefined

          const newBalance = (baseRecord?.balance || 0) + monthlyAmount

          await window.electronAPI.db.query(`
            INSERT INTO account_balances (id, account_id, balance, recorded_at, memo)
            VALUES (?, ?, ?, ?, ?)
          `, [
            uuidv4(),
            rule.account_id,
            newBalance,
            balanceRecordedAt,
            `[자동] ${rule.name} 예산 적립`
          ])
        }

        createdCount++
      }

      const message = `${createdCount}건의 거래가 생성되었습니다.`
      alert(message)
      loadTransactions()
      loadMonthsWithData()
      loadBudgetSummaries()
    } catch (error) {
      console.error('Failed to generate auto transactions:', error)
      alert('자동 거래 생성에 실패했습니다.')
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
      renderCell: (params: GridRenderCellParams<Transaction>) => {
        const tags = params.row.tag ? params.row.tag.split(',').map((t: string) => t.trim()).filter(Boolean) : []
        return (
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
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
            {tags.map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  bgcolor: 'grey.100',
                  color: 'grey.600',
                  border: '1px solid',
                  borderColor: 'grey.300',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ))}
          </Stack>
        )
      },
    },
    {
      field: 'category_name',
      headerName: '카테고리',
      width: 130,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <Typography
          variant="body2"
          onDoubleClick={(e) => {
            setCategoryPickerTransaction(params.row)
            setCategoryPickerAnchor(e.currentTarget)
          }}
          sx={{ cursor: 'default', '&:hover': { color: 'primary.main' }, userSelect: 'none' }}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'budget_item_name',
      headerName: '예산',
      width: 120,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
        <Typography variant="body2" color={params.value ? 'text.primary' : 'text.disabled'}>
          {params.value || '미지정'}
        </Typography>
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
            자동 거래 생성
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
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" color="text.secondary">
              예산별 지출
            </Typography>
            <ToggleButtonGroup
              value={budgetDisplayCurrency}
              exclusive
              onChange={(_, value) => value && setBudgetDisplayCurrency(value)}
              size="small"
            >
              <ToggleButton value="KRW" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
                KRW
              </ToggleButton>
              <ToggleButton value="AED" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
                AED
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
            {budgetSummaries.map((budget) => {
              const displaySpent = budgetDisplayCurrency === 'AED'
                ? budget.spent_amount / exchangeRate
                : budget.spent_amount
              const displayBudget = budgetDisplayCurrency === 'AED'
                ? budget.budget_amount / exchangeRate
                : budget.budget_amount
              const currencyUnit = budgetDisplayCurrency === 'AED' ? 'AED' : '원'
              const formatKRW = (amount: number) => {
                const rounded = Math.round(amount)
                if (rounded >= 10000) return `${Math.round(rounded / 10000)}만`
                return rounded.toLocaleString()
              }
              const isOverBudget = budget.spent_amount > budget.budget_amount
              const overAmount = budget.spent_amount - budget.budget_amount
              const withinBudgetPercent = budget.budget_amount > 0
                ? Math.min((budget.spent_amount / budget.budget_amount) * 100, 100)
                : 0
              const overBudgetPercent = isOverBudget && budget.budget_amount > 0
                ? Math.min((overAmount / budget.budget_amount) * 100, 50)
                : 0
              const isSelected = selectedBudgetItem === budget.budget_item_id
              const hasNoCategories = !budget.category_names
              return (
                <Tooltip
                  key={budget.budget_item_id}
                  title={budget.category_names || '연결된 카테고리 없음'}
                  placement="top"
                  arrow
                >
                <Card
                  onClick={() => toggleBudgetItemSelection(budget.budget_item_id)}
                  onDoubleClick={(e) => { e.stopPropagation(); handleBudgetCardDoubleClick(budget.budget_item_id) }}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: 1,
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    bgcolor: isSelected ? 'primary.50' : 'background.paper',
                    opacity: selectedBudgetItem && !isSelected ? 0.4 : 1,
                    ...(hasNoCategories && {
                      backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)',
                    }),
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'grey.300',
                    },
                  }}
                >
                  <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {budget.budget_item_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {budgetDisplayCurrency === 'KRW'
                          ? `${formatKRW(displaySpent)} / ${formatKRW(displayBudget)}원`
                          : `${Math.round(displaySpent).toLocaleString()} / ${Math.round(displayBudget).toLocaleString()} AED`
                        }
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        display: 'flex',
                        width: '100%',
                        height: 2,
                        borderRadius: 1,
                        overflow: 'hidden',
                        bgcolor: 'grey.200',
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
                  </CardContent>
                </Card>
                </Tooltip>
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

      <CategoryPicker
        anchorEl={categoryPickerAnchor}
        onClose={() => { setCategoryPickerAnchor(null); setCategoryPickerTransaction(null) }}
        transactionType={categoryPickerTransaction?.type || 'expense'}
        selectedCategoryId={categoryPickerTransaction?.category_id || ''}
        onSelect={(categoryId) => {
          if (categoryPickerTransaction) {
            handleCategoryChange(categoryPickerTransaction.id, categoryId)
          }
        }}
      />

      <BudgetItemModal
        open={budgetItemModalOpen}
        onClose={() => { setBudgetItemModalOpen(false); setEditingBudgetItem(null) }}
        onSaved={() => { setBudgetItemModalOpen(false); setEditingBudgetItem(null); loadBudgetSummaries() }}
        editItem={editingBudgetItem}
      />
    </Box>
  )
}
