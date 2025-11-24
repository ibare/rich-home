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
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { IconTrash, IconPlus } from '@tabler/icons-react'
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
  date: string
  description: string | null
  memo: string | null
  include_in_stats: number
}

interface BudgetSummary {
  budget_item_id: string
  budget_item_name: string
  budget_amount: number
  spent_amount: number
}

interface BudgetItem {
  id: string
  name: string
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
        `SELECT id, name FROM budget_items WHERE is_active = 1 ORDER BY sort_order`
      )
      setBudgetItems(result as BudgetItem[])
    } catch (error) {
      console.error('Failed to load budget items:', error)
    }
  }

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
           LIMIT 1) as budget_item_name
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

  // 예산별 지출 집계 조회
  const loadBudgetSummaries = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate =
        selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // 환율을 적용하여 모든 금액을 KRW로 환산
      const query = `
        SELECT
          bi.id as budget_item_id,
          bi.name as budget_item_name,
          CASE WHEN bi.currency = 'AED'
            THEN COALESCE(mb.amount, bi.base_amount) * ?
            ELSE COALESCE(mb.amount, bi.base_amount)
          END as budget_amount,
          COALESCE((
            SELECT SUM(
              CASE WHEN t.currency = 'AED'
                THEN t.amount * ?
                ELSE t.amount
              END
            )
            FROM transactions t
            JOIN budget_item_categories bic ON t.category_id = bic.category_id
            WHERE bic.budget_item_id = bi.id
              AND t.date >= ?
              AND t.date < ?
              AND t.type = 'expense'
              AND t.include_in_stats = 1
          ), 0) as spent_amount
        FROM budget_items bi
        LEFT JOIN monthly_budgets mb ON bi.id = mb.budget_item_id
          AND mb.year = ? AND mb.month = ?
        WHERE bi.is_active = 1
        ORDER BY bi.sort_order
      `

      const result = await window.electronAPI.db.query(query, [
        exchangeRate,
        exchangeRate,
        startDate,
        endDate,
        selectedYear,
        selectedMonth,
      ])
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
      width: 50,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Transaction>) => (
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
            예산별 지출
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
              return (
                <Card key={budget.budget_item_id}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="body1" fontWeight={600}>
                        {budget.budget_item_name}
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
        rows={transactions}
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
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
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
