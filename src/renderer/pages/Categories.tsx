import { Box, Typography, Card, CardContent, Button } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'

export default function Categories() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">카테고리</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          카테고리 추가
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center" py={4}>
            카테고리 목록이 표시됩니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
