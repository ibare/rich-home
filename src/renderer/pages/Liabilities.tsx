import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
} from '@mui/material'
import { IconHome, IconCreditCard, IconCar, IconReceipt } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import LiabilityModal from '../components/modals/LiabilityModal'

interface Liability {
  id: string
  name: string
  type: 'mortgage' | 'credit_loan' | 'jeonse_deposit' | 'car_loan' | 'other'
  principal_amount: number
  current_balance: number
  interest_rate: number | null
  start_date: string
  end_date: string | null
  currency: string
  memo: string | null
  is_active: number
}

const typeLabels: Record<string, string> = {
  mortgage: '주택담보대출',
  credit_loan: '신용대출',
  jeonse_deposit: '전세보증금',
  car_loan: '자동차대출',
  other: '기타',
}

const typeIcons: Record<string, React.ReactNode> = {
  mortgage: <IconHome size={24} />,
  credit_loan: <IconCreditCard size={24} />,
  jeonse_deposit: <IconReceipt size={24} />,
  car_loan: <IconCar size={24} />,
  other: <IconCreditCard size={24} />,
}

export default function Liabilities() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(385)

  useEffect(() => {
    setPageTitle('부채 관리')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [liabilitiesResult, rateResult] = await Promise.all([
        window.electronAPI.db.query(
          'SELECT * FROM liabilities WHERE is_active = 1 ORDER BY type, start_date DESC'
        ),
        window.electronAPI.db.get(
          "SELECT value FROM settings WHERE key = 'aed_to_krw_rate'"
        ),
      ])
      setLiabilities(liabilitiesResult as Liability[])
      if (rateResult) {
        setExchangeRate(parseFloat((rateResult as { value: string }).value))
      }
    } catch (error) {
      console.error('Failed to load liabilities:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString()}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // AED를 KRW로 환산하는 함수
  const toKRW = (amount: number, currency: string) => {
    if (currency === 'AED') {
      return amount * exchangeRate
    }
    return amount
  }

  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + toKRW(l.current_balance, l.currency),
    0
  )

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {liabilities.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary" textAlign="center" py={4}>
              등록된 부채가 없습니다. 부채를 등록해보세요.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    총 부채 (원화 환산)
                  </Typography>
                  <Typography variant="h3" fontWeight={600} color="error.main">
                    KRW {totalLiabilities.toLocaleString()}
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  환율: 1 AED = {exchangeRate.toLocaleString()} KRW
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            {liabilities.map((liability) => (
              <Card key={liability.id} elevation={2}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'error.light',
                          color: 'error.main',
                        }}
                      >
                        {typeIcons[liability.type]}
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="h6">{liability.name}</Typography>
                          <Chip
                            label={typeLabels[liability.type]}
                            size="small"
                            color="error"
                            variant="outlined"
                          />
                          {liability.interest_rate && (
                            <Chip
                              label={`${liability.interest_rate}%`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          <Chip
                            label={liability.currency}
                            size="small"
                            color={liability.currency === 'KRW' ? 'primary' : 'secondary'}
                          />
                        </Stack>
                        <Typography variant="body2" color="textSecondary">
                          {formatDate(liability.start_date)} 시작
                          {liability.end_date && ` ~ ${formatDate(liability.end_date)}`}
                          {liability.memo && ` · ${liability.memo}`}
                        </Typography>
                      </Box>
                    </Stack>

                    <Box textAlign="right">
                      <Typography variant="h5" fontWeight={600} color="error.main">
                        {formatCurrency(liability.current_balance, liability.currency)}
                      </Typography>
                      {liability.current_balance !== liability.principal_amount && (
                        <Typography variant="body2" color="textSecondary">
                          원금: {formatCurrency(liability.principal_amount, liability.currency)}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <LiabilityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />
    </Box>
  )
}
