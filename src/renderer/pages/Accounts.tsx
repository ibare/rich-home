import { Box, Typography, Card, CardContent, Button } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'

export default function Accounts() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">계좌 관리</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          계좌 추가
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center" py={4}>
            등록된 계좌가 없습니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
