import { Box, Typography, Card, CardContent } from '@mui/material'

export default function Statistics() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        통계
      </Typography>

      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center" py={4}>
            수입/지출 통계 및 차트가 표시됩니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
