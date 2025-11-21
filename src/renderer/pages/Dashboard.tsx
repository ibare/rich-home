import { useEffect } from 'react'
import { Box, Grid, Typography, Avatar, Stack } from '@mui/material'
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'

export default function Dashboard() {
  const { setPageTitle, setOnAdd } = usePageContext()

  useEffect(() => {
    setPageTitle('대시보드')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

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
      <Grid container spacing={3}>
        {/* 총 자산 */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <DashboardCard>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: 'primary.light',
                  width: 48,
                  height: 48,
                }}
              >
                <IconWallet size="24" color="#5D87FF" />
              </Avatar>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  총 자산
                </Typography>
                <Typography variant="h4" fontWeight={600}>
                  {formatCurrency(summary.totalBalance)}
                </Typography>
              </Box>
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 이번 달 수입 */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <DashboardCard>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: 'success.light',
                  width: 48,
                  height: 48,
                }}
              >
                <IconArrowUpRight size="24" color="#13DEB9" />
              </Avatar>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  이번 달 수입
                </Typography>
                <Typography variant="h4" fontWeight={600} color="success.main">
                  {formatCurrency(summary.monthlyIncome)}
                </Typography>
              </Box>
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 이번 달 지출 */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <DashboardCard>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: 'error.light',
                  width: 48,
                  height: 48,
                }}
              >
                <IconArrowDownRight size="24" color="#FA896B" />
              </Avatar>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">
                  이번 달 지출
                </Typography>
                <Typography variant="h4" fontWeight={600} color="error.main">
                  {formatCurrency(summary.monthlyExpense)}
                </Typography>
              </Box>
            </Stack>
          </DashboardCard>
        </Grid>

        {/* 최근 거래 */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <DashboardCard title="최근 거래">
            <Typography color="textSecondary" textAlign="center" py={4}>
              거래 내역이 없습니다. 새 거래를 추가해보세요.
            </Typography>
          </DashboardCard>
        </Grid>

        {/* 카테고리별 지출 */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <DashboardCard title="카테고리별 지출">
            <Typography color="textSecondary" textAlign="center" py={4}>
              이번 달 지출 내역이 없습니다.
            </Typography>
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  )
}
