import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  Grid,
  TextField,
  InputAdornment,
} from '@mui/material'
import { IconDownload, IconUpload, IconCheck } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'

export default function Settings() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [exchangeRate, setExchangeRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setPageTitle('설정')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI.db.get(
        "SELECT value FROM settings WHERE key = 'aed_to_krw_rate'"
      )
      if (result) {
        setExchangeRate((result as { value: string }).value)
      } else {
        setExchangeRate('385')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      setExchangeRate('385')
    }
  }

  const handleSaveExchangeRate = async () => {
    const rate = parseFloat(exchangeRate.replace(/,/g, ''))
    if (isNaN(rate) || rate <= 0) {
      alert('올바른 환율을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      await window.electronAPI.db.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ('aed_to_krw_rate', ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
        [rate.toString(), rate.toString()]
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Failed to save exchange rate:', error)
      alert('환율 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatNumber = (value: string) => {
    const num = value.replace(/[^\d.]/g, '')
    if (num === '') return ''
    const parsed = parseFloat(num)
    if (isNaN(parsed)) return ''
    return parsed.toLocaleString()
  }

  const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || !isNaN(parseFloat(raw))) {
      setExchangeRate(formatNumber(raw))
    }
  }

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard title="환율 설정">
            <Stack spacing={2}>
              <Typography variant="body2" color="textSecondary">
                AED(디르함)를 원화로 환산할 때 사용되는 환율입니다.
              </Typography>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  label="1 AED"
                  value={exchangeRate}
                  onChange={handleExchangeRateChange}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">KRW</InputAdornment>,
                  }}
                  placeholder="385"
                  size="small"
                  sx={{ width: 200 }}
                />
                <Button
                  variant="contained"
                  onClick={handleSaveExchangeRate}
                  disabled={saving}
                  startIcon={saved ? <IconCheck size={18} /> : undefined}
                  color={saved ? 'success' : 'primary'}
                >
                  {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
                </Button>
              </Stack>
              <Typography variant="caption" color="textSecondary">
                예: 1 AED = 385 KRW
              </Typography>
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard title="데이터 관리">
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<IconDownload size="18" />}>
                데이터 내보내기
              </Button>
              <Button variant="outlined" startIcon={<IconUpload size="18" />}>
                데이터 가져오기
              </Button>
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard title="앱 정보">
            <Typography color="textSecondary">Rich Home v1.0.0</Typography>
            <Typography color="textSecondary" variant="body2">
              개인 재산 관리 가계부
            </Typography>
          </DashboardCard>
        </Grid>
      </Grid>
    </Box>
  )
}
