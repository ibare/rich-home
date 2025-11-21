import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
} from '@mui/material'
import { IconHome, IconChartLine } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import AssetModal from '../components/modals/AssetModal'

interface Asset {
  id: string
  name: string
  type: 'real_estate' | 'stock'
  purchase_amount: number
  purchase_date: string
  quantity: number
  currency: string
  memo: string | null
  is_active: number
}

const typeLabels: Record<string, string> = {
  real_estate: '부동산',
  stock: '주식',
}

interface Liability {
  current_balance: number
  currency: string
}

export default function Assets() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [assets, setAssets] = useState<Asset[]>([])
  const [totalLiabilities, setTotalLiabilities] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(385)

  useEffect(() => {
    setPageTitle('자산 관리')
    setOnAdd(() => setModalOpen(true))
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [assetsResult, liabilitiesResult, rateResult] = await Promise.all([
        window.electronAPI.db.query(
          'SELECT * FROM assets WHERE is_active = 1 ORDER BY type, purchase_date DESC'
        ),
        window.electronAPI.db.query(
          'SELECT current_balance, currency FROM liabilities WHERE is_active = 1'
        ),
        window.electronAPI.db.get(
          "SELECT value FROM settings WHERE key = 'aed_to_krw_rate'"
        ),
      ])
      setAssets(assetsResult as Asset[])

      let rate = 385
      if (rateResult) {
        rate = parseFloat((rateResult as { value: string }).value)
        setExchangeRate(rate)
      }

      // 부채 총액 계산 (원화 환산)
      const liabilities = liabilitiesResult as Liability[]
      const totalLiab = liabilities.reduce((sum, l) => {
        const amount = l.currency === 'AED' ? l.current_balance * rate : l.current_balance
        return sum + amount
      }, 0)
      setTotalLiabilities(totalLiab)
    } catch (error) {
      console.error('Failed to load assets:', error)
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

  const realEstateAssets = assets.filter((a) => a.type === 'real_estate')
  const stockAssets = assets.filter((a) => a.type === 'stock')

  // AED를 KRW로 환산하는 함수
  const toKRW = (amount: number, currency: string) => {
    if (currency === 'AED') {
      return amount * exchangeRate
    }
    return amount
  }

  const totalRealEstate = realEstateAssets.reduce(
    (sum, a) => sum + toKRW(a.purchase_amount * a.quantity, a.currency),
    0
  )
  const totalStock = stockAssets.reduce(
    (sum, a) => sum + toKRW(a.purchase_amount * a.quantity, a.currency),
    0
  )
  const totalAssets = totalRealEstate + totalStock
  const netWorth = totalAssets - totalLiabilities

  if (loading) {
    return (
      <Box>
        <Typography>로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box>
      {assets.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="textSecondary" textAlign="center" py={4}>
              등록된 자산이 없습니다. 자산을 등록해보세요.
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
                  순자산 (자산 - 부채)
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={600}
                  color={netWorth >= 0 ? 'success.main' : 'error.main'}
                >
                  KRW {netWorth.toLocaleString()}
                </Typography>
              </Box>
              <Stack spacing={0.5} alignItems="flex-end">
                <Typography variant="body2" color="textSecondary">
                  총 자산: KRW {totalAssets.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="error.main">
                  총 부채: KRW {totalLiabilities.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  환율: 1 AED = {exchangeRate.toLocaleString()} KRW
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Stack spacing={3}>
          {/* 부동산 */}
          {realEstateAssets.length > 0 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  부동산
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  KRW {totalRealEstate.toLocaleString()}
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {realEstateAssets.map((asset) => (
                  <Card key={asset.id} elevation={2}>
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
                              bgcolor: 'warning.light',
                              color: 'warning.main',
                            }}
                          >
                            <IconHome size={24} />
                          </Box>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="h6">{asset.name}</Typography>
                              <Chip
                                label={typeLabels[asset.type]}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            </Stack>
                            <Typography variant="body2" color="textSecondary">
                              {formatDate(asset.purchase_date)} 취득
                              {asset.memo && ` · ${asset.memo}`}
                            </Typography>
                          </Box>
                        </Stack>

                        <Typography variant="h5" fontWeight={600}>
                          {formatCurrency(asset.purchase_amount, asset.currency)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {/* 주식 */}
          {stockAssets.length > 0 && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  주식
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  KRW {totalStock.toLocaleString()}
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {stockAssets.map((asset) => (
                  <Card key={asset.id} elevation={2}>
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
                              bgcolor: 'info.light',
                              color: 'info.main',
                            }}
                          >
                            <IconChartLine size={24} />
                          </Box>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="h6">{asset.name}</Typography>
                              <Chip
                                label={`${asset.quantity}주`}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={asset.currency}
                                size="small"
                                color={asset.currency === 'KRW' ? 'primary' : 'secondary'}
                              />
                            </Stack>
                            <Typography variant="body2" color="textSecondary">
                              {formatDate(asset.purchase_date)} 매수
                              {asset.memo && ` · ${asset.memo}`}
                            </Typography>
                          </Box>
                        </Stack>

                        <Box textAlign="right">
                          <Typography variant="h5" fontWeight={600}>
                            {formatCurrency(asset.purchase_amount * asset.quantity, asset.currency)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            @{formatCurrency(asset.purchase_amount, asset.currency)}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
        </>
      )}

      <AssetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
      />
    </Box>
  )
}
