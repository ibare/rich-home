import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Receipt as ReceiptIcon,
  AccountBalance as AccountIcon,
  Category as CategoryIcon,
  Savings as BudgetIcon,
  BarChart as StatsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'

interface SidebarProps {
  drawerWidth: number
  mobileOpen: boolean
  onDrawerToggle: () => void
}

const menuItems = [
  { path: '/', label: '대시보드', icon: <DashboardIcon /> },
  { path: '/transactions', label: '거래 내역', icon: <ReceiptIcon /> },
  { path: '/accounts', label: '계좌 관리', icon: <AccountIcon /> },
  { path: '/categories', label: '카테고리', icon: <CategoryIcon /> },
  { path: '/budget', label: '예산', icon: <BudgetIcon /> },
  { path: '/statistics', label: '통계', icon: <StatsIcon /> },
]

export default function Sidebar({ drawerWidth, mobileOpen, onDrawerToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        className="drag-region"
        sx={{
          p: 2,
          pt: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography
          variant="h5"
          className="no-drag"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          Rich Home
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flex: 1, px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'white',
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                  '&:hover': {
                    backgroundColor: 'primary.main',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <List sx={{ px: 1, pb: 2 }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={location.pathname === '/settings'}
            onClick={() => navigate('/settings')}
            sx={{
              borderRadius: 2,
              '&.Mui-selected': {
                backgroundColor: 'primary.light',
                color: 'white',
                '& .MuiListItemIcon-root': {
                  color: 'white',
                },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary="설정" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  )
}
