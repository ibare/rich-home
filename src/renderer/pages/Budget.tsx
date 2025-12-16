import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material'
import {
  IconEdit,
  IconTrash,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import BudgetItemModal from '../components/modals/BudgetItemModal'
import AmountText from '../components/shared/AmountText'

interface BudgetItem {
  id: string
  name: string
  group_name: string | null
  budget_type: string
  base_amount: number
  currency: string
  memo: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: number
  account_id: string | null
  category_names?: string
}

const budgetTypeLabels: Record<string, string> = {
  fixed_monthly: '고정',
  variable_monthly: '변동',
  distributed: '분배',
}

type SortKey = 'name' | 'budget_type' | 'category_names' | 'base_amount' | 'monthly_amount'
type SortOrder = 'asc' | 'desc'

export default function Budget() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<BudgetItem | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // 환율
  const [exchangeRate, setExchangeRate] = useState(385)

  useEffect(() => {
    setPageTitle('예산 관리')
    setOnAdd(() => setModalOpen(true))
    loadExchangeRate()
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

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
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.db.query(`
        SELECT bi.id, bi.name, bi.group_name, bi.budget_type, bi.base_amount, bi.currency,
               bi.memo, bi.valid_from, bi.valid_to, bi.is_active, bi.account_id,
               GROUP_CONCAT(c.name, ', ') as category_names
        FROM budget_items bi
        LEFT JOIN budget_item_categories bic ON bi.id = bic.budget_item_id
        LEFT JOIN categories c ON bic.category_id = c.id
        WHERE bi.is_active = 1
        GROUP BY bi.id
        ORDER BY bi.group_name, bi.sort_order, bi.name
      `)
      setBudgetItems(result as BudgetItem[])
    } catch (error) {
      console.error('Failed to load budget data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMonthlyAmount = (item: BudgetItem) => {
    if (item.budget_type === 'distributed' && item.valid_from && item.valid_to) {
      const from = new Date(item.valid_from)
      const to = new Date(item.valid_to)
      const months = Math.max(1,
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
      )
      return Math.round(item.base_amount / months)
    }
    return item.base_amount
  }

  const handleEditClick = (item: BudgetItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleDeleteClick = (item: BudgetItem) => {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingItem) return

    try {
      await window.electronAPI.db.query(
        'DELETE FROM budget_item_categories WHERE budget_item_id = ?',
        [deletingItem.id]
      )
      await window.electronAPI.db.query(
        'DELETE FROM budget_items WHERE id = ?',
        [deletingItem.id]
      )

      setDeleteDialogOpen(false)
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

  // 정렬 핸들러
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // 정렬된 예산 항목
  const sortedBudgetItems = useMemo(() => {
    return [...budgetItems].sort((a, b) => {
      let comparison = 0
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ko')
          break
        case 'budget_type':
          comparison = a.budget_type.localeCompare(b.budget_type)
          break
        case 'category_names':
          comparison = (a.category_names || '').localeCompare(b.category_names || '', 'ko')
          break
        case 'base_amount':
          comparison = a.base_amount - b.base_amount
          break
        case 'monthly_amount':
          comparison = getMonthlyAmount(a) - getMonthlyAmount(b)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [budgetItems, sortKey, sortOrder])

  // 총 월 예산 계산
  const totalMonthlyBudget = budgetItems.reduce((sum, item) => {
    const monthlyAmount = getMonthlyAmount(item)
    return sum + (item.currency === 'AED' ? monthlyAmount * exchangeRate : monthlyAmount)
  }, 0)

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {/* 총 예산 카드 */}
      {budgetItems.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              월 예산 합계
            </Typography>
            <AmountText
              amount={totalMonthlyBudget}
              currency="KRW"
              variant="h3"
              fontWeight={600}
            />
          </CardContent>
        </Card>
      )}

      {/* 예산 항목 목록 */}
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
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'name'}
                      direction={sortKey === 'name' ? sortOrder : 'asc'}
                      onClick={() => handleSort('name')}
                    >
                      예산 항목
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'budget_type'}
                      direction={sortKey === 'budget_type' ? sortOrder : 'asc'}
                      onClick={() => handleSort('budget_type')}
                    >
                      유형
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortKey === 'category_names'}
                      direction={sortKey === 'category_names' ? sortOrder : 'asc'}
                      onClick={() => handleSort('category_names')}
                    >
                      연결 카테고리
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'base_amount'}
                      direction={sortKey === 'base_amount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('base_amount')}
                    >
                      기준 금액
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === 'monthly_amount'}
                      direction={sortKey === 'monthly_amount' ? sortOrder : 'asc'}
                      onClick={() => handleSort('monthly_amount')}
                    >
                      월 예산
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="center" width={80}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBudgetItems.map((item) => (
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
                          <IconButton size="small" onClick={() => handleEditClick(item)}>
                            <IconEdit size={16} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(item)}
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

      <BudgetItemModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={loadData}
        editItem={editingItem}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>예산 항목 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deletingItem?.name}</strong> 항목을 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">
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
