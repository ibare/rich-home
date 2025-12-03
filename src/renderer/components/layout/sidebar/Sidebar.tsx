import { Box, Drawer } from '@mui/material'
import SidebarItems from './SidebarItems'

interface SidebarProps {
  isCollapsed: boolean
}

const Sidebar = ({ isCollapsed }: SidebarProps) => {
  const sidebarWidth = isCollapsed ? '70px' : '270px'

  const scrollbarStyles = {
    '&::-webkit-scrollbar': {
      width: '7px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#eff2f7',
      borderRadius: '15px',
    },
  }

  return (
    <Box
      sx={{
        width: sidebarWidth,
        flexShrink: 0,
        transition: 'width 0.2s ease-in-out',
      }}
    >
      <Drawer
        anchor="left"
        open
        variant="permanent"
        PaperProps={{
          sx: {
            boxSizing: 'border-box',
            ...scrollbarStyles,
            width: sidebarWidth,
            borderRight: '1px solid',
            borderColor: 'divider',
            transition: 'width 0.2s ease-in-out',
            overflowX: 'hidden',
          },
        }}
      >
        <Box sx={{ height: '100%' }}>
          <SidebarItems isCollapsed={isCollapsed} />
        </Box>
      </Drawer>
    </Box>
  )
}

export default Sidebar
