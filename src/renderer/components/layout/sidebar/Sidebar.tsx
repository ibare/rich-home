import { useMediaQuery, Box, Drawer, useTheme } from '@mui/material'
import SidebarItems from './SidebarItems'

interface SidebarProps {
  isSidebarOpen: boolean
  isMobileSidebarOpen: boolean
  onSidebarClose: () => void
}

const Sidebar = ({
  isSidebarOpen,
  isMobileSidebarOpen,
  onSidebarClose,
}: SidebarProps) => {
  const theme = useTheme()
  const lgUp = useMediaQuery(theme.breakpoints.up('lg'))
  const sidebarWidth = '270px'

  const scrollbarStyles = {
    '&::-webkit-scrollbar': {
      width: '7px',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: '#eff2f7',
      borderRadius: '15px',
    },
  }

  if (lgUp) {
    return (
      <Box
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
        }}
      >
        <Drawer
          anchor="left"
          open={isSidebarOpen}
          variant="permanent"
          PaperProps={{
            sx: {
              boxSizing: 'border-box',
              ...scrollbarStyles,
              width: sidebarWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Box sx={{ height: '100%' }}>
            <SidebarItems />
          </Box>
        </Drawer>
      </Box>
    )
  }

  return (
    <Drawer
      anchor="left"
      open={isMobileSidebarOpen}
      onClose={onSidebarClose}
      variant="temporary"
      PaperProps={{
        sx: {
          boxShadow: theme.shadows[8],
          width: sidebarWidth,
          ...scrollbarStyles,
        },
      }}
    >
      <Box>
        <SidebarItems />
      </Box>
    </Drawer>
  )
}

export default Sidebar
