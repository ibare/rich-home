import { useEffect, useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { usePageContext } from '../contexts/PageContext'
import { useExchangeRate } from '../hooks/useExchangeRate'
import MonthlyStatistics from './statistics/MonthlyStatistics'
import YearlyStatistics from './statistics/YearlyStatistics'

export default function Statistics() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const { exchangeRate } = useExchangeRate()
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    setPageTitle('통계')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          aria-label="통계 탭"
        >
          <Tab label="월간 통계" />
          <Tab label="연간 통계" />
        </Tabs>
      </Box>

      {activeTab === 0 && <MonthlyStatistics exchangeRate={exchangeRate} />}
      {activeTab === 1 && <YearlyStatistics exchangeRate={exchangeRate} />}
    </Box>
  )
}
