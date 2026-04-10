import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'

interface BudgetSummary {
  budget_item_id: string
  budget_item_name: string
  budget_amount: number
  spent_amount: number
  category_names: string
}

interface BudgetSummaryPanelProps {
  budgetSummaries: BudgetSummary[]
  exchangeRate: number
  budgetDisplayCurrency: 'KRW' | 'AED'
  onDisplayCurrencyChange: (currency: 'KRW' | 'AED') => void
  selectedBudgetItem: string | null
  onToggleBudgetItem: (budgetItemId: string) => void
  onBudgetCardDoubleClick: (budgetItemId: string) => void
}

const formatKRW = (amount: number) => {
  const rounded = Math.round(amount)
  if (rounded >= 10000) return `${Math.round(rounded / 10000)}만`
  return rounded.toLocaleString()
}

export default function BudgetSummaryPanel({
  budgetSummaries,
  exchangeRate,
  budgetDisplayCurrency,
  onDisplayCurrencyChange,
  selectedBudgetItem,
  onToggleBudgetItem,
  onBudgetCardDoubleClick,
}: BudgetSummaryPanelProps) {
  if (budgetSummaries.length === 0) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          예산별 지출
        </Typography>
        <ToggleButtonGroup
          value={budgetDisplayCurrency}
          exclusive
          onChange={(_, value) => value && onDisplayCurrencyChange(value)}
          size="small"
        >
          <ToggleButton value="KRW" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
            KRW
          </ToggleButton>
          <ToggleButton value="AED" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>
            AED
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
        {budgetSummaries.map((budget) => {
          const displaySpent = budgetDisplayCurrency === 'AED'
            ? budget.spent_amount / exchangeRate
            : budget.spent_amount
          const displayBudget = budgetDisplayCurrency === 'AED'
            ? budget.budget_amount / exchangeRate
            : budget.budget_amount
          const isOverBudget = budget.spent_amount > budget.budget_amount
          const overAmount = budget.spent_amount - budget.budget_amount
          const withinBudgetPercent = budget.budget_amount > 0
            ? Math.min((budget.spent_amount / budget.budget_amount) * 100, 100)
            : 0
          const overBudgetPercent = isOverBudget && budget.budget_amount > 0
            ? Math.min((overAmount / budget.budget_amount) * 100, 50)
            : 0
          const isSelected = selectedBudgetItem === budget.budget_item_id
          const hasNoCategories = !budget.category_names
          return (
            <Tooltip
              key={budget.budget_item_id}
              title={budget.category_names || '연결된 카테고리 없음'}
              placement="top"
              arrow
            >
            <Card
              onClick={() => onToggleBudgetItem(budget.budget_item_id)}
              onDoubleClick={(e) => { e.stopPropagation(); onBudgetCardDoubleClick(budget.budget_item_id) }}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 1,
                borderColor: isSelected ? 'primary.main' : 'transparent',
                bgcolor: isSelected ? 'primary.50' : 'background.paper',
                opacity: selectedBudgetItem && !isSelected ? 0.4 : 1,
                ...(hasNoCategories && {
                  backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)',
                }),
                '&:hover': {
                  borderColor: isSelected ? 'primary.main' : 'grey.300',
                },
              }}
            >
              <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {budget.budget_item_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {budgetDisplayCurrency === 'KRW'
                      ? `${formatKRW(displaySpent)} / ${formatKRW(displayBudget)}원`
                      : `${Math.round(displaySpent).toLocaleString()} / ${Math.round(displayBudget).toLocaleString()} AED`
                    }
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    display: 'flex',
                    width: '100%',
                    height: 2,
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'grey.200',
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
              </CardContent>
            </Card>
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}
