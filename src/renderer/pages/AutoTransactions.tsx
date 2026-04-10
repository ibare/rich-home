import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
} from '@mui/material'
import { IconEdit, IconTrash, IconCircleCheck, IconAlertTriangle, IconClock } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import AutoTransactionRuleModal from '../components/modals/AutoTransactionRuleModal'
import AmountText from '../components/shared/AmountText'
import { useToast } from '../contexts/ToastContext'
import { getAutoTransactionRules, deleteAutoTransactionRule } from '../repositories/autoTransactionRepository'

interface AutoTransactionRule {
  id: string
  name: string
  rule_type: string
  base_amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  valid_from: string | null
  valid_to: string | null
  memo: string | null
  category_name: string | null
  account_name: string | null
}

export default function AutoTransactions() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const { showWarning, showError } = useToast()
  const [rules, setRules] = useState<AutoTransactionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AutoTransactionRule | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<AutoTransactionRule | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    setPageTitle('자동 거래 생성 규칙')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getAutoTransactionRules()
      setRules(result as AutoTransactionRule[])
    } catch (error) {
      console.error('Failed to load auto transaction rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMonthlyAmount = (rule: AutoTransactionRule) => {
    if (rule.rule_type === 'distributed' && rule.valid_from && rule.valid_to) {
      const from = new Date(rule.valid_from)
      const to = new Date(rule.valid_to)
      const months = Math.max(1,
        (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
      )
      return Math.round(rule.base_amount / months)
    }
    return rule.base_amount
  }

  const formatPeriod = (rule: AutoTransactionRule) => {
    if (!rule.valid_from || !rule.valid_to) return '-'
    const from = new Date(rule.valid_from)
    const to = new Date(rule.valid_to)
    const months = Math.max(1,
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    )
    return `${rule.valid_from} ~ ${rule.valid_to} (${months}개월)`
  }

  const handleEditClick = (item: AutoTransactionRule) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleDeleteClick = (item: AutoTransactionRule) => {
    setDeletingItem(item)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await deleteAutoTransactionRule(deletingItem.id)
      setDeleteDialogOpen(false)
      setDeletingItem(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete auto transaction rule:', error)
      showError('자동 거래 규칙 삭제에 실패했습니다.')
    }
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingItem(null)
  }

  const getRuleStatus = (rule: AutoTransactionRule): { type: 'ok' | 'expired' | 'incomplete'; message: string } => {
    if (!rule.category_id) {
      return { type: 'incomplete', message: '카테고리가 설정되지 않아 자동 거래가 생성되지 않습니다.' }
    }
    if (rule.valid_to) {
      const now = new Date()
      const validTo = new Date(rule.valid_to)
      const endOfMonth = new Date(validTo.getFullYear(), validTo.getMonth() + 1, 0)
      if (now > endOfMonth) {
        return { type: 'expired', message: `유효기간이 만료되었습니다. (${rule.valid_to})` }
      }
    }
    return { type: 'ok', message: '정상' }
  }

  const distributedRules = rules.filter(r => r.rule_type === 'distributed')
  const fixedMonthlyRules = rules.filter(r => r.rule_type === 'fixed_monthly')

  const currentTabRules = activeTab === 0 ? distributedRules : fixedMonthlyRules
  const defaultRuleType = activeTab === 0 ? 'distributed' : 'fixed_monthly'

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
        >
          <Tab label={`분배 (${distributedRules.length})`} />
          <Tab label={`월 자동 생성 (${fixedMonthlyRules.length})`} />
        </Tabs>
      </Box>

      {currentTabRules.length === 0 ? (
        <Card>
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">
              {activeTab === 0
                ? '분배 규칙이 없습니다. 우상단 + 버튼으로 추가하세요.'
                : '월 자동 생성 규칙이 없습니다. 우상단 + 버튼으로 추가하세요.'}
            </Typography>
          </Box>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>이름</TableCell>
                  <TableCell>카테고리</TableCell>
                  <TableCell align="right">
                    {activeTab === 0 ? '총 금액' : '월 금액'}
                  </TableCell>
                  {activeTab === 0 && (
                    <TableCell align="right">월 금액</TableCell>
                  )}
                  {activeTab === 0 && (
                    <TableCell>유효 기간</TableCell>
                  )}
                  {activeTab === 1 && (
                    <TableCell>연결 계좌</TableCell>
                  )}
                  <TableCell align="center" width={80}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentTabRules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {(() => {
                          const status = getRuleStatus(rule)
                          if (status.type === 'ok') {
                            return <IconCircleCheck size={18} color="#4caf50" />
                          }
                          return (
                            <Box
                              component="span"
                              sx={{ display: 'flex', cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); showWarning(status.message) }}
                            >
                              {status.type === 'expired'
                                ? <IconClock size={18} color="#f44336" />
                                : <IconAlertTriangle size={18} color="#ff9800" />
                              }
                            </Box>
                          )
                        })()}
                        <Typography fontWeight={500}>{rule.name}</Typography>
                      </Stack>
                      {rule.memo && (
                        <Typography variant="caption" color="textSecondary">
                          {rule.memo}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {rule.category_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <AmountText amount={rule.base_amount} currency={rule.currency} />
                    </TableCell>
                    {activeTab === 0 && (
                      <TableCell align="right">
                        <AmountText
                          amount={getMonthlyAmount(rule)}
                          currency={rule.currency}
                          fontWeight={600}
                        />
                      </TableCell>
                    )}
                    {activeTab === 0 && (
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {formatPeriod(rule)}
                        </Typography>
                      </TableCell>
                    )}
                    {activeTab === 1 && (
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {rule.account_name ? `🐷 ${rule.account_name}` : '-'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton size="small" onClick={() => handleEditClick(rule)}>
                          <IconEdit size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(rule)}
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

      <AutoTransactionRuleModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={loadData}
        editItem={editingItem}
        defaultRuleType={defaultRuleType}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>자동 거래 규칙 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{deletingItem?.name}</strong> 규칙을 삭제하시겠습니까?
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
