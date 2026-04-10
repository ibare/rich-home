import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  Stack,
  IconButton,
  Divider,
} from '@mui/material'
import { IconTrash } from '@tabler/icons-react'

interface PendingTransaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  category_name: string
  date: string
  description: string
  tags: string[]
}

interface PendingTransactionListProps {
  pendingList: PendingTransaction[]
  onRemove: (id: string) => void
}

export default function PendingTransactionList({ pendingList, onRemove }: PendingTransactionListProps) {
  const totalExpense = pendingList
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = pendingList
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <>
      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>
        추가된 거래 ({pendingList.length}건)
      </Typography>

      {pendingList.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            위 폼에서 거래를 추가하세요.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>유형</TableCell>
                  <TableCell>날짜</TableCell>
                  <TableCell>카테고리</TableCell>
                  <TableCell>내용</TableCell>
                  <TableCell align="right">금액</TableCell>
                  <TableCell width={40}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingList.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell>
                      <Chip
                        label={tx.type === 'expense' ? '지출' : '수입'}
                        size="small"
                        color={tx.type === 'expense' ? 'error' : 'success'}
                      />
                    </TableCell>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2">{tx.category_name}</Typography>
                        {tx.tags.map((tag, index) => (
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
                    </TableCell>
                    <TableCell>{tx.description || '-'}</TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight={500}
                        color={tx.type === 'expense' ? 'error.main' : 'success.main'}
                      >
                        {tx.type === 'expense' ? '-' : '+'}
                        {tx.currency} {tx.amount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => onRemove(tx.id)}
                        color="error"
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 합계 */}
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="flex-end" spacing={4}>
              {totalIncome > 0 && (
                <Typography color="success.main" fontWeight={600}>
                  수입: +KRW {totalIncome.toLocaleString()}
                </Typography>
              )}
              {totalExpense > 0 && (
                <Typography color="error.main" fontWeight={600}>
                  지출: -KRW {totalExpense.toLocaleString()}
                </Typography>
              )}
            </Stack>
          </Box>
        </>
      )}
    </>
  )
}
