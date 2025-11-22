import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  Grid,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material'
import {
  IconDownload,
  IconUpload,
  IconCheck,
  IconFolder,
  IconRefresh,
  IconDatabase,
} from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'

interface DbPathInfo {
  currentPath: string
  defaultPath: string
  isCustom: boolean
}

export default function Settings() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [exchangeRate, setExchangeRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // DB 경로 관련 상태
  const [dbPathInfo, setDbPathInfo] = useState<DbPathInfo | null>(null)
  const [changePathDialogOpen, setChangePathDialogOpen] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [copyExisting, setCopyExisting] = useState(true)
  const [changingPath, setChangingPath] = useState(false)

  useEffect(() => {
    setPageTitle('설정')
    setOnAdd(null)
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadSettings()
    loadDbPath()
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

  const loadDbPath = async () => {
    try {
      const pathInfo = await window.electronAPI.db.getPath()
      setDbPathInfo(pathInfo)
    } catch (error) {
      console.error('Failed to load DB path:', error)
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

  const handleSelectFolder = async () => {
    const result = await window.electronAPI.db.selectFolder()
    if (!result.canceled && result.path) {
      setSelectedPath(result.path)
      setChangePathDialogOpen(true)
    }
  }

  const handleChangePath = async () => {
    if (!selectedPath) return

    setChangingPath(true)
    try {
      const result = await window.electronAPI.db.changePath(selectedPath, copyExisting)
      if (result.success) {
        setChangePathDialogOpen(false)
        // 앱 재시작 안내
        if (confirm('데이터베이스 경로가 변경되었습니다. 앱을 재시작하시겠습니까?')) {
          await window.electronAPI.app.restart()
        } else {
          loadDbPath()
        }
      } else {
        alert(result.error || '경로 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to change DB path:', error)
      alert('경로 변경에 실패했습니다.')
    } finally {
      setChangingPath(false)
    }
  }

  const handleResetPath = async () => {
    if (!confirm('데이터베이스를 기본 위치로 되돌리시겠습니까?')) return

    try {
      const result = await window.electronAPI.db.resetPath()
      if (result.success) {
        if (confirm('기본 위치로 변경되었습니다. 앱을 재시작하시겠습니까?')) {
          await window.electronAPI.app.restart()
        } else {
          loadDbPath()
        }
      } else {
        alert(result.error || '경로 초기화에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to reset DB path:', error)
      alert('경로 초기화에 실패했습니다.')
    }
  }

  return (
    <Box>
      <Grid container spacing={3}>
        {/* 데이터베이스 저장 위치 */}
        <Grid size={{ xs: 12 }}>
          <DashboardCard title="데이터베이스 저장 위치">
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconDatabase size={20} />
                <Typography variant="body2" color="textSecondary">
                  현재 경로:
                </Typography>
                {dbPathInfo?.isCustom && (
                  <Chip label="사용자 지정" size="small" color="primary" />
                )}
              </Stack>

              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all',
                }}
              >
                {dbPathInfo?.currentPath || '로딩 중...'}
              </Box>

              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<IconFolder size={18} />}
                  onClick={handleSelectFolder}
                >
                  위치 변경
                </Button>
                {dbPathInfo?.isCustom && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<IconRefresh size={18} />}
                    onClick={handleResetPath}
                  >
                    기본 위치로 복원
                  </Button>
                )}
              </Stack>

              {dbPathInfo?.isCustom && (
                <Typography variant="caption" color="textSecondary">
                  기본 경로: {dbPathInfo.defaultPath}
                </Typography>
              )}
            </Stack>
          </DashboardCard>
        </Grid>

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

      {/* 경로 변경 다이얼로그 */}
      <Dialog
        open={changePathDialogOpen}
        onClose={() => setChangePathDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>데이터베이스 위치 변경</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              새 위치:
            </Typography>
            <Box
              sx={{
                p: 1.5,
                bgcolor: 'grey.100',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                wordBreak: 'break-all',
              }}
            >
              {selectedPath}/rich-home.db
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={copyExisting}
                  onChange={(e) => setCopyExisting(e.target.checked)}
                />
              }
              label="기존 데이터를 새 위치로 복사"
            />

            <Alert severity="warning">
              경로 변경 후 앱이 재시작됩니다.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setChangePathDialogOpen(false)} color="inherit">
            취소
          </Button>
          <Button
            onClick={handleChangePath}
            variant="contained"
            disabled={changingPath}
          >
            {changingPath ? '변경 중...' : '위치 변경'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
