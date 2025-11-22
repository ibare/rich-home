import { ReactNode } from 'react'
import { Box, Typography, Stack, IconButton } from '@mui/material'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

interface MonthNavigationProps {
  selectedYear: number
  selectedMonth: number
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  monthsWithData?: Set<number>
  actionSlot?: ReactNode
}

export default function MonthNavigation({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  monthsWithData = new Set(),
  actionSlot,
}: MonthNavigationProps) {
  const navigateYear = (direction: number) => {
    onYearChange(selectedYear + direction)
  }

  return (
    <Box sx={{ mb: 3 }}>
      {/* 년도 타이틀 + 액션 영역 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, ml: 1 }}>
        <Typography variant="h4" fontWeight={700}>
          {selectedYear}
        </Typography>
        {actionSlot && <Box>{actionSlot}</Box>}
      </Stack>

      {/* 12개월 그리드 */}
      <Stack direction="row" alignItems="center" spacing={0}>
        <IconButton onClick={() => navigateYear(-1)} size="small">
          <IconChevronLeft />
        </IconButton>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const hasData = monthsWithData.has(month)
            const isSelected = month === selectedMonth

            return (
              <Box
                key={month}
                onClick={() => onMonthChange(month)}
                sx={{
                  py: 1.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: isSelected ? 'info.light' : 'transparent',
                  borderRight: month < 12 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: isSelected ? 'info.light' : 'action.hover',
                  },
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={hasData || isSelected ? 700 : 400}
                  sx={{
                    color: isSelected
                      ? 'text.primary'
                      : hasData
                        ? 'text.primary'
                        : 'rgba(0, 0, 0, 0.25)',
                    minWidth: '3em',
                    display: 'inline-block',
                  }}
                >
                  {month}월
                </Typography>
              </Box>
            )
          })}
        </Box>

        <IconButton onClick={() => navigateYear(1)} size="small">
          <IconChevronRight />
        </IconButton>
      </Stack>
    </Box>
  )
}
