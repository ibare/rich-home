import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'
import { IconCircleFilled } from '@tabler/icons-react'
import { usePageContext } from '../contexts/PageContext'
import DashboardCard from '../components/shared/DashboardCard'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  expense_type: 'fixed' | 'variable' | null
  color: string
  icon: string
  is_active: number
  sort_order: number
}

export default function Categories() {
  const { setPageTitle, setOnAdd } = usePageContext()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('카테고리')
    setOnAdd(null) // 카테고리 추가 기능은 나중에 구현
    return () => setOnAdd(null)
  }, [setPageTitle, setOnAdd])

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.db.query(
        'SELECT * FROM categories WHERE is_active = 1 ORDER BY type, expense_type, sort_order'
      )
      setCategories(result as Category[])
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const fixedExpenseCategories = categories.filter(
    (c) => c.type === 'expense' && c.expense_type === 'fixed'
  )
  const variableExpenseCategories = categories.filter(
    (c) => c.type === 'expense' && c.expense_type === 'variable'
  )

  const CategoryList = ({ items, title }: { items: Category[]; title: string }) => (
    <Box mb={3}>
      <Typography variant="subtitle1" fontWeight={600} color="textSecondary" mb={1}>
        {title} ({items.length})
      </Typography>
      <List dense disablePadding>
        {items.map((cat) => (
          <ListItem
            key={cat.id}
            sx={{
              py: 1,
              px: 2,
              mb: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <IconCircleFilled size={12} style={{ color: cat.color }} />
            </ListItemIcon>
            <ListItemText primary={cat.name} />
          </ListItem>
        ))}
      </List>
    </Box>
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
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        {/* 수입 카테고리 */}
        <Box flex={1}>
          <DashboardCard
            title="수입"
            action={
              <Chip label={`${incomeCategories.length}개`} size="small" color="success" />
            }
          >
            <List dense disablePadding>
              {incomeCategories.map((cat) => (
                <ListItem
                  key={cat.id}
                  sx={{
                    py: 1,
                    px: 2,
                    mb: 0.5,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <IconCircleFilled size={12} style={{ color: cat.color }} />
                  </ListItemIcon>
                  <ListItemText primary={cat.name} />
                </ListItem>
              ))}
            </List>
          </DashboardCard>
        </Box>

        {/* 지출 카테고리 */}
        <Box flex={2}>
          <DashboardCard
            title="지출"
            action={
              <Chip
                label={`${fixedExpenseCategories.length + variableExpenseCategories.length}개`}
                size="small"
                color="error"
              />
            }
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box flex={1}>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  color="textSecondary"
                  mb={1}
                >
                  고정비 ({fixedExpenseCategories.length})
                </Typography>
                <List dense disablePadding>
                  {fixedExpenseCategories.map((cat) => (
                    <ListItem
                      key={cat.id}
                      sx={{
                        py: 1,
                        px: 2,
                        mb: 0.5,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <IconCircleFilled size={12} style={{ color: cat.color }} />
                      </ListItemIcon>
                      <ListItemText primary={cat.name} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box flex={1}>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  color="textSecondary"
                  mb={1}
                >
                  변동비 ({variableExpenseCategories.length})
                </Typography>
                <List dense disablePadding>
                  {variableExpenseCategories.map((cat) => (
                    <ListItem
                      key={cat.id}
                      sx={{
                        py: 1,
                        px: 2,
                        mb: 0.5,
                        borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <IconCircleFilled size={12} style={{ color: cat.color }} />
                      </ListItemIcon>
                      <ListItemText primary={cat.name} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Stack>
          </DashboardCard>
        </Box>
      </Stack>
    </Box>
  )
}
