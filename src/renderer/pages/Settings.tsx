import { Box, Typography, Card, CardContent, Button, Stack } from '@mui/material'
import { Download as ExportIcon, Upload as ImportIcon } from '@mui/icons-material'

export default function Settings() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        설정
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              데이터 관리
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<ExportIcon />}>
                데이터 내보내기
              </Button>
              <Button variant="outlined" startIcon={<ImportIcon />}>
                데이터 가져오기
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              앱 정보
            </Typography>
            <Typography color="text.secondary">
              Rich Home v1.0.0
            </Typography>
            <Typography color="text.secondary" variant="body2">
              개인 재산 관리 가계부
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}
