import { Box, Card, CardContent, Grid, Typography } from '@mui/material'
import {
  TrendingUp as IncomeIcon,
  TrendingDown as ExpenseIcon,
  AccountBalance as BalanceIcon,
} from '@mui/icons-material'

export default function Dashboard() {
  // TODO: 실제 데이터로 교체
  const summary = {
    totalBalance: 5000000,
    monthlyIncome: 3500000,
    monthlyExpense: 2100000,
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount)
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        대시보드
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: 'primary.light',
                    color: 'white',
                  }}
                >
                  <BalanceIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    총 자산
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {formatCurrency(summary.totalBalance)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: 'success.light',
                    color: 'white',
                  }}
                >
                  <IncomeIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    이번 달 수입
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="success.main">
                    {formatCurrency(summary.monthlyIncome)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: 'error.light',
                    color: 'white',
                  }}
                >
                  <ExpenseIcon />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    이번 달 지출
                  </Typography>
                  <Typography variant="h5" fontWeight={600} color="error.main">
                    {formatCurrency(summary.monthlyExpense)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                최근 거래
              </Typography>
              <Typography color="text.secondary">
                거래 내역이 없습니다. 새 거래를 추가해보세요.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
