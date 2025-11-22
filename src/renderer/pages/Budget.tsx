import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  IconCopy,
  IconLock,
  IconX,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import BudgetItemModal from '../components/modals/BudgetItemModal'
import AmountText from '../components/shared/AmountText'
import MonthNavigation from '../components/shared/MonthNavigation'

interface BudgetItem {
  id: string
  name: string
  budget_type: string
  base_amount: number
  currency: string
  memo: string | null
  is_active: number
  category_names?: string
}

interface MonthlyBudget {
  id: string
  budget_item_id: string
  year: number
  month: number
  amount: number
  is_confirmed: number
  item_name?: string
  budget_type?: string
  currency?: string
}

const budgetTypeLabels: Record<string, string> = {
  fixed_monthly: '고정',
  variable_monthly: '변동',
  annual: '연간분배',
  quarterly: '분기분배',
}

export default function Budget() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [tab, setTab] = useState(0)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<BudgetItem | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<MonthlyBudget | null>(null)
  const [editAmount, setEditAmount] = useState('')

  // 현재 선택된 월
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  // 월별 데이터 존재 여부
  const [monthsWithData, setMonthsWithData] = useState<Set<number>>(new Set())

  // 환율
  const [exchangeRate, setExchangeRate] = useState(385) // AED to KRW

  useEffect(() => {
    setPageTitle('예산 관리')
    setOnAdd(() => setModalOpen(true))
    loadExchangeRate()
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadMonthsWithData()
  }, [selectedYear])

  const loadExchangeRate = async () => {
    try {
      const result = await window.electronAPI.db.get(
        "SELECT value FROM settings WHERE key = 'aed_to_krw_rate'"
      ) as { value: string } | undefined
      if (result) {
        setExchangeRate(parseFloat(result.value))
      }
    } catch (error) {
      console.error('Failed to load exchange rate:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedYear, selectedMonth])

  // 해당 연도의 월별 예산 존재 여부 조회
  const loadMonthsWithData = async () => {
    try {
      const result = await window.electronAPI.db.query(
        'SELECT DISTINCT month FROM monthly_budgets WHERE year = ?',
        [selectedYear]
      ) as { month: number }[]

      setMonthsWithData(new Set(result.map((r) => r.month)))
    } catch (error) {
      console.error('Failed to load months with data:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // 예산 항목 템플릿 조회
      const itemsResult = await window.electronAPI.db.query(`
        SELECT bi.*, GROUP_CONCAT(c.name, ', ') as category_names
        FROM budget_items bi
        LEFT JOIN budget_item_categories bic ON bi.id = bic.budget_item_id
        LEFT JOIN categories c ON bic.category_id = c.id
        WHERE bi.is_active = 1
        GROUP BY bi.id
        ORDER BY bi.sort_order, bi.name
      `)
      setBudgetItems(itemsResult as BudgetItem[])

      // 월별 예산 조회
      const monthlyResult = await window.electronAPI.db.query(`
        SELECT mb.*, bi.name as item_name, bi.budget_type, bi.currency
        FROM monthly_budgets mb
        JOIN budget_items bi ON mb.budget_item_id = bi.id
        WHERE mb.year = ? AND mb.month = ?
        ORDER BY bi.sort_order, bi.name
      `, [selectedYear, selectedMonth])
      setMonthlyBudgets(monthlyResult as MonthlyBudget[])
    } catch (error) {
      console.error('Failed to load budget data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMonthlyAmount = (item: BudgetItem) => {
    switch (item.budget_type) {
      case 'annual':
        return Math.round(item.base_amount / 12)
      case 'quarterly':
        return Math.round(item.base_amount / 3)
      default:
        return item.base_amount
    }
  }

  // 템플릿에서 월별 예산 복사
  const copyFromTemplate = async () => {
    if (monthlyBudgets.length > 0) {
      if (!confirm('이미 이번 달 예산이 있습니다. 템플릿으로 덮어쓰시겠습니까?')) {
        return
      }
    }

    try {
      // 기존 월별 예산 삭제
      await window.electronAPI.db.query(
        'DELETE FROM monthly_budgets WHERE year = ? AND month = ?',
        [selectedYear, selectedMonth]
      )

      // 템플릿에서 복사
      for (const item of budgetItems) {
        const amount = getMonthlyAmount(item)
        await window.electronAPI.db.query(
          `INSERT INTO monthly_budgets (id, budget_item_id, year, month, amount)
           VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), item.id, selectedYear, selectedMonth, amount]
        )
      }

      loadData()
    } catch (error) {
      console.error('Failed to copy from template:', error)
      alert('템플릿 복사에 실패했습니다.')
    }
  }

  // 이전 달에서 복사
  const copyFromPrevMonth = async () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear

    try {
      const prevBudgets = await window.electronAPI.db.query(
        'SELECT * FROM monthly_budgets WHERE year = ? AND month = ?',
        [prevYear, prevMonth]
      ) as MonthlyBudget[]

      if (prevBudgets.length === 0) {
        alert('이전 달 예산이 없습니다.')
        return
      }

      if (monthlyBudgets.length > 0) {
        if (!confirm('이미 이번 달 예산이 있습니다. 이전 달 예산으로 덮어쓰시겠습니까?')) {
          return
        }
      }

      // 기존 월별 예산 삭제
      await window.electronAPI.db.query(
        'DELETE FROM monthly_budgets WHERE year = ? AND month = ?',
        [selectedYear, selectedMonth]
      )

      // 이전 달에서 복사
      for (const budget of prevBudgets) {
        await window.electronAPI.db.query(
          `INSERT INTO monthly_budgets (id, budget_item_id, year, month, amount)
           VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), budget.budget_item_id, selectedYear, selectedMonth, budget.amount]
        )
      }

      loadData()
    } catch (error) {
      console.error('Failed to copy from previous month:', error)
      alert('이전 달 복사에 실패했습니다.')
    }
  }

  // 금액 수정
  const handleEditClick = (budget: MonthlyBudget) => {
    setEditingBudget(budget)
    setEditAmount(budget.amount.toLocaleString())
    setEditModalOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingBudget) return

    const amount = parseFloat(editAmount.replace(/,/g, ''))
    if (isNaN(amount) || amount < 0) {
      alert('올바른 금액을 입력해주세요.')
      return
    }

    try {
      await window.electronAPI.db.query(
        'UPDATE monthly_budgets SET amount = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [amount, editingBudget.id]
      )
      setEditModalOpen(false)
      setEditingBudget(null)
      loadData()
    } catch (error) {
      console.error('Failed to update budget:', error)
      alert('금액 수정에 실패했습니다.')
    }
  }

  // 예산 항목 수정 클릭
  const handleEditItemClick = (item: BudgetItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  // 예산 항목 삭제 클릭
  const handleDeleteItemClick = (item: BudgetItem) => {
    setDeletingItem(item)
    setDeleteItemDialogOpen(true)
  }

  // 예산 항목 삭제 실행
  const handleDeleteItem = async () => {
    if (!deletingItem) return

    try {
      // 카테고리 매핑 먼저 삭제
      await window.electronAPI.db.query(
        'DELETE FROM budget_item_categories WHERE budget_item_id = ?',
        [deletingItem.id]
      )
      // 월별 예산에서도 삭제
      await window.electronAPI.db.query(
        'DELETE FROM monthly_budgets WHERE budget_item_id = ?',
        [deletingItem.id]
      )
      // 예산 항목 삭제
      await window.electronAPI.db.query(
        'DELETE FROM budget_items WHERE id = ?',
        [deletingItem.id]
      )

      setDeleteItemDialogOpen(false)
      setDeletingItem(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete budget item:', error)
      alert('예산 항목 삭제에 실패했습니다.')
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingItem(null)
  }

  const isConfirmed = monthlyBudgets.length > 0 && monthlyBudgets.every((b) => b.is_confirmed)
  const totalBudget = monthlyBudgets.reduce((sum, b) => sum + b.amount, 0)

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="월별 예산" />
        <Tab label="예산 항목 템플릿" />
      </Tabs>

      {tab === 0 && (
        <>
          <MonthNavigation
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            monthsWithData={monthsWithData}
            actionSlot={
              <Stack direction="row" spacing={1} alignItems="center">
                {isConfirmed ? (
                  <Chip
                    icon={<IconLock size={14} />}
                    label="마감됨"
                    color="success"
                    size="small"
                  />
                ) : (
                  <>
                    <Button
                      size="small"
                      startIcon={<IconCopy size={16} />}
                      onClick={copyFromTemplate}
                    >
                      템플릿 복사
                    </Button>
                    <Button
                      size="small"
                      startIcon={<IconCopy size={16} />}
                      onClick={copyFromPrevMonth}
                    >
                      전월 복사
                    </Button>
                  </>
                )}
              </Stack>
            }
          />

          {/* 총 예산 */}
          {monthlyBudgets.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  총 예산
                </Typography>
                <AmountText
                  amount={totalBudget}
                  currency="KRW"
                  variant="h3"
                  fontWeight={600}
                />
              </CardContent>
            </Card>
          )}

          {/* 월별 예산 목록 */}
          {monthlyBudgets.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="textSecondary" textAlign="center" py={4}>
                  이번 달 예산이 없습니다. 템플릿 또는 전월에서 복사하세요.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>예산 항목</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell align="right">예산 금액</TableCell>
                      <TableCell align="center" width={60}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthlyBudgets.map((budget) => (
                      <TableRow key={budget.id} hover>
                        <TableCell>
                          <Typography fontWeight={500}>{budget.item_name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={budgetTypeLabels[budget.budget_type || ''] || budget.budget_type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <AmountText
                            amount={budget.amount}
                            currency={budget.currency || 'KRW'}
                            fontWeight={600}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {!isConfirmed && (
                            <IconButton
                              size="small"
                              onClick={() => handleEditClick(budget)}
                            >
                              <IconEdit size={16} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}

      {tab === 1 && (
        <>
          {/* 템플릿 월 예산 합계 */}
          {budgetItems.length > 0 && (() => {
            const totalKRW = budgetItems.reduce((sum, item) => {
              const monthlyAmount = getMonthlyAmount(item)
              return sum + (item.currency === 'AED' ? monthlyAmount * exchangeRate : monthlyAmount)
            }, 0)
            return (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    월 예산 합계 (템플릿 기준)
                  </Typography>
                  <AmountText
                    amount={totalKRW}
                    currency="KRW"
                    variant="h3"
                    fontWeight={600}
                  />
                </CardContent>
              </Card>
            )
          })()}

          {/* 예산 항목 템플릿 목록 */}
          {budgetItems.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="textSecondary" textAlign="center" py={4}>
                  예산 항목이 없습니다. 우상단 + 버튼으로 추가하세요.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>예산 항목</TableCell>
                      <TableCell>유형</TableCell>
                      <TableCell>연결 카테고리</TableCell>
                      <TableCell align="right">기준 금액</TableCell>
                      <TableCell align="right">월 분배액</TableCell>
                      <TableCell align="center" width={80}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {budgetItems.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Typography fontWeight={500}>{item.name}</Typography>
                          {item.memo && (
                            <Typography variant="caption" color="textSecondary">
                              {item.memo}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={budgetTypeLabels[item.budget_type]}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="textSecondary">
                            {item.category_names || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <AmountText amount={item.base_amount} currency={item.currency} />
                        </TableCell>
                        <TableCell align="right">
                          <AmountText
                            amount={getMonthlyAmount(item)}
                            currency={item.currency}
                            fontWeight={600}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <IconButton size="small" onClick={() => handleEditItemClick(item)}>
                              <IconEdit size={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteItemClick(item)}
                              sx={{ color: 'error.main' }}
                            >
                              <IconTrash size={16} />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}

      <BudgetItemModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={loadData}
        editItem={editingItem}
      />

      {/* 예산 항목 삭제 확인 다이얼로그 */}
      <Dialog open={deleteItemDialogOpen} onClose={() => setDeleteItemDialogOpen(false)}>
        <DialogTitle>예산 항목 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deletingItem?.name}</strong> 항목을 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            해당 항목의 모든 월별 예산 데이터도 함께 삭제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteItemDialogOpen(false)} color="inherit">
            취소
          </Button>
          <Button onClick={handleDeleteItem} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 금액 수정 모달 */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          예산 금액 수정
          <IconButton size="small" onClick={() => setEditModalOpen(false)}>
            <IconX size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="예산 금액"
            value={editAmount}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '')
              const currency = editingBudget?.currency || 'KRW'

              if (currency === 'AED') {
                // AED는 소수점 2자리까지 허용
                if (raw === '' || raw === '.' || !isNaN(parseFloat(raw)) || raw.endsWith('.')) {
                  const parts = raw.split('.')
                  if (parts.length > 2) return
                  if (parts[1]?.length > 2) {
                    parts[1] = parts[1].slice(0, 2)
                  }
                  const num = parseFloat(parts.join('.'))
                  if (raw === '' || raw === '.') {
                    setEditAmount(raw)
                  } else if (!isNaN(num)) {
                    let formatted = num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    if (raw.endsWith('.')) formatted += '.'
                    else if (parts.length === 2 && parts[1] === '') formatted += '.'
                    setEditAmount(formatted)
                  }
                }
              } else {
                // KRW는 정수만
                if (raw === '' || !isNaN(parseFloat(raw))) {
                  const num = parseInt(raw.split('.')[0], 10)
                  setEditAmount(isNaN(num) ? '' : num.toLocaleString())
                }
              }
            }}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditModalOpen(false)} color="inherit">
            취소
          </Button>
          <Button onClick={handleEditSave} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
