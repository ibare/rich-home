import { Typography, Box } from '@mui/material'
import type { TypographyProps } from '@mui/material'

interface AmountTextProps {
  amount: number
  currency: string
  variant?: TypographyProps['variant']
  color?: TypographyProps['color']
  fontWeight?: number
  showSign?: boolean // +/- 부호 표시
  signType?: 'income' | 'expense' | 'auto' // auto: 양수면 +, 음수면 -
}

export default function AmountText({
  amount,
  currency,
  variant = 'body1',
  color = 'textPrimary',
  fontWeight = 400,
  showSign = false,
  signType,
}: AmountTextProps) {
  // AED: 소수점 이하가 있으면 2자리, 없으면 정수로 표시
  const isWholeNumber = currency === 'AED' && amount % 1 === 0
  const formattedAmount = Math.abs(amount).toLocaleString('ko-KR', {
    minimumFractionDigits: currency === 'AED' && !isWholeNumber ? 2 : 0,
    maximumFractionDigits: currency === 'AED' ? 2 : 0,
  })

  // 부호 결정
  let sign = ''
  if (showSign) {
    if (signType === 'income') {
      sign = '+'
    } else if (signType === 'expense') {
      sign = '-'
    } else if (signType === 'auto') {
      sign = amount >= 0 ? '+' : '-'
    }
  }

  // 단위 텍스트
  const unitText = currency === 'KRW' ? '원' : ' AED'

  return (
    <Typography
      variant={variant}
      color={color}
      fontWeight={fontWeight}
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'baseline' }}
    >
      {sign}
      {formattedAmount}
      <Box
        component="span"
        sx={{
          fontSize: '0.6em',
          color: 'text.secondary',
          ml: currency === 'KRW' ? 0 : 0.5,
        }}
      >
        {unitText}
      </Box>
    </Typography>
  )
}

// 간단한 문자열 포맷 함수 (JSX가 필요없는 경우)
export function formatAmount(amount: number, currency: string): string {
  const isWholeNumber = currency === 'AED' && amount % 1 === 0
  const formatted = Math.abs(amount).toLocaleString('ko-KR', {
    minimumFractionDigits: currency === 'AED' && !isWholeNumber ? 2 : 0,
    maximumFractionDigits: currency === 'AED' ? 2 : 0,
  })
  return currency === 'KRW' ? `${formatted} 원` : `${formatted} AED`
}
