import { Box, Typography, Card, CardContent } from '@mui/material'

export default function Budget() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        예산 관리
      </Typography>

      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center" py={4}>
            예산을 설정하고 지출을 추적하세요.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
