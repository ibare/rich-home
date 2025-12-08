import { useState } from 'react'
import {
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  SxProps,
  Theme,
} from '@mui/material'
import { IconCalculator } from '@tabler/icons-react'

interface AmountInputProps {
  value: string
  currency: string
  onChange: (amount: string, currency: string) => void
  label?: string
  size?: 'small' | 'medium'
  autoFocus?: boolean
  sx?: SxProps<Theme>
  inputRef?: React.Ref<HTMLInputElement>
}

// 숫자 포맷팅 함수
// finalize: true면 최종 포맷팅 (blur 시), false면 입력 중 포맷팅
const formatNumber = (value: string, currency: string, finalize = false): string => {
  const num = value.replace(/[^\d.]/g, '')
  if (num === '') return ''

  // AED는 소수점 2자리 고정
  if (currency === 'AED') {
    const parts = num.split('.')

    // 소수점이 2개 이상인 경우 첫 번째 소수점만 유지
    if (parts.length > 2) {
      return formatNumber(parts[0] + '.' + parts.slice(1).join(''), currency, finalize)
    }

    // 정수 부분 포맷팅
    const intPart = parts[0]
    const parsedInt = parseInt(intPart, 10)
    if (isNaN(parsedInt) && intPart !== '') return ''
    const formattedInt = intPart === '' ? '0' : parsedInt.toLocaleString()

    // 소수점이 있는 경우
    if (parts.length === 2) {
      const decPart = parts[1]
      // 소수점만 있고 숫자가 없는 경우
      if (decPart === '') {
        // 최종 포맷팅이면 소수점 제거, 입력 중이면 소수점 유지
        return finalize ? formattedInt : formattedInt + '.'
      }
      // 소수점 이하 숫자가 있으면 2자리까지 허용
      const trimmedDec = decPart.slice(0, 2)
      // 최종 포맷팅이면 2자리로 패딩, 입력 중이면 그대로
      const finalDec = finalize ? trimmedDec.padEnd(2, '0') : trimmedDec
      return formattedInt + '.' + finalDec
    }

    return intPart === '' ? '' : formattedInt
  }

  // KRW는 정수만
  const parsed = parseInt(num.split('.')[0], 10)
  if (isNaN(parsed)) return ''
  return parsed.toLocaleString()
}

export default function AmountInput({
  value,
  currency,
  onChange,
  label = '금액',
  size = 'small',
  autoFocus = false,
  sx,
  inputRef,
}: AmountInputProps) {
  // 더하기 계산기 상태
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcLines, setCalcLines] = useState('')

  // 통화 토글
  const toggleCurrency = () => {
    const newCurrency = currency === 'KRW' ? 'AED' : 'KRW'
    const reformattedAmount = value ? formatNumber(value.replace(/,/g, ''), newCurrency) : ''
    onChange(reformattedAmount, newCurrency)
  }

  // 금액 입력 처리
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '.' || !isNaN(parseFloat(raw)) || (raw.endsWith('.') && currency === 'AED')) {
      onChange(formatNumber(raw, currency, false), currency)
    }
  }

  // blur 시 최종 포맷팅 적용
  const handleBlur = () => {
    if (value && currency === 'AED') {
      onChange(formatNumber(value.replace(/,/g, ''), currency, true), currency)
    }
  }

  // 더하기 계산기 열기
  const openCalculator = () => {
    const currentAmount = value.replace(/,/g, '')
    if (currentAmount && !isNaN(parseFloat(currentAmount)) && parseFloat(currentAmount) > 0) {
      setCalcLines(currentAmount)
    } else {
      setCalcLines('')
    }
    setCalcOpen(true)
  }

  // 더하기 계산기 입력 변경 - 실시간 금액 반영
  const handleCalcLinesChange = (inputValue: string) => {
    setCalcLines(inputValue)
    // 실시간으로 합계를 금액 필드에 반영
    const sum = inputValue
      .split('\n')
      .map((line) => parseFloat(line.replace(/,/g, '').trim()) || 0)
      .reduce((s, num) => s + num, 0)
    if (sum >= 0) {
      onChange(formatNumber(String(sum), currency), currency)
    }
  }

  // 더하기 계산기 닫기
  const closeCalculator = () => {
    setCalcOpen(false)
  }

  return (
    <>
      <TextField
        inputRef={inputRef}
        label={label}
        value={value}
        onChange={handleAmountChange}
        onBlur={handleBlur}
        size={size}
        sx={{ width: 270, ...sx }}
        InputProps={{
          startAdornment: (
            <InputAdornment
              position="start"
              onClick={toggleCurrency}
              sx={{
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': {
                  color: 'primary.main',
                },
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {currency}
              </Typography>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={openCalculator}
                sx={{ p: 0.5 }}
              >
                <IconCalculator size={18} />
              </IconButton>
            </InputAdornment>
          ),
        }}
        placeholder="0"
        autoFocus={autoFocus}
      />

      {/* 더하기 계산기 다이얼로그 */}
      <Dialog
        open={calcOpen}
        onClose={closeCalculator}
        maxWidth="xs"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogContent sx={{ p: 2, minWidth: 200 }}>
          <TextField
            multiline
            minRows={5}
            maxRows={10}
            value={calcLines}
            onChange={(e) => handleCalcLinesChange(e.target.value)}
            placeholder="숫자를 입력하세요&#10;엔터로 줄을 추가하면&#10;합계가 계산됩니다"
            fullWidth
            autoFocus
            onKeyDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
                fontSize: '1.1rem',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={closeCalculator} color="inherit" variant="outlined">
            취소
          </Button>
          <Button onClick={closeCalculator} variant="outlined">
            적용
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// 숫자 포맷팅 함수를 외부에서 사용할 수 있도록 export
export { formatNumber }
