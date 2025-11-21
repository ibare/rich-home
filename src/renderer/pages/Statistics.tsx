import { useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'

export default function Statistics() {
  const { setPageTitle, setOnAdd } = usePageContext()

  useEffect(() => {
    setPageTitle('통계')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  return (
    <Box>
      <DashboardCard>
        <Typography color="textSecondary" textAlign="center" py={4}>
          수입/지출 통계 및 차트가 표시됩니다.
        </Typography>
      </DashboardCard>
    </Box>
  )
}
