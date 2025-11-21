import { Box, Typography, Card, CardContent, Button } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'

export default function Transactions() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">거래 내역</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          새 거래
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center" py={4}>
            거래 내역이 없습니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
