import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography, Tooltip } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import { IconPoint } from '@tabler/icons-react'
import MenuItems from './MenuItems'
import titleImg from '@assets/title.png'
import logoImg from '@assets/application-icon.png'

interface SidebarItemsProps {
  isCollapsed: boolean
}

const SidebarItems = ({ isCollapsed }: SidebarItemsProps) => {
  const location = useLocation()
  const pathDirect = location.pathname

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 드래그 영역 */}
      <Box sx={{ pt: '20px' }} className="drag-region" />

      {/* 로고 영역 */}
      <Box
        component={Link}
        to="/"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          px: isCollapsed ? 1 : 3,
          py: 2,
          textDecoration: 'none',
          mb: 1,
        }}
      >
        {isCollapsed ? (
          <img src={logoImg} alt="Rich Home" style={{ height: 32 }} />
        ) : (
          <img src={titleImg} alt="Rich Home" style={{ height: 68, marginTop: 10 }} />
        )}
      </Box>

      {/* 메뉴 목록 */}
      <List sx={{ px: isCollapsed ? 1 : 2 }}>
        {MenuItems.map((item) => {
          const Icon = item.icon || IconPoint
          const isSelected = pathDirect === item.href

          if (item.navlabel) {
            if (isCollapsed) {
              return null
            }
            return (
              <Typography
                key={item.id}
                variant="caption"
                sx={{
                  px: 2,
                  py: 1,
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {item.subheader}
              </Typography>
            )
          }

          const menuItem = (
            <ListItemButton
              component={Link}
              to={item.href || '/'}
              selected={isSelected}
              sx={{
                borderRadius: '8px',
                mb: 0.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                px: isCollapsed ? 1.5 : 2,
                minHeight: 44,
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: isCollapsed ? 0 : 36,
                  color: isSelected ? 'primary.main' : 'text.secondary',
                }}
              >
                <Icon stroke={1.5} size="1.3rem" />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
              )}
            </ListItemButton>
          )

          if (isCollapsed) {
            return (
              <Tooltip key={item.id} title={item.title} placement="right" arrow>
                {menuItem}
              </Tooltip>
            )
          }

          return <Box key={item.id}>{menuItem}</Box>
        })}
      </List>
    </Box>
  )
}

export default SidebarItems
