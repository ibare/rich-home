import { Box, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar as MUI_Sidebar,
  Logo,
  Menu,
  MenuItem,
} from 'react-mui-sidebar'
import { IconPoint } from '@tabler/icons-react'
import MenuItems from './MenuItems'

const SidebarItems = () => {
  const location = useLocation()
  const pathDirect = location.pathname

  return (
    <MUI_Sidebar
      width="100%"
      showProfile={false}
      themeColor="#5D87FF"
      themeSecondaryColor="#49beff"
    >
      <Box sx={{ pt: '20px' }} className="drag-region" />
      <Logo img="" component={Link} to="/">
        <Typography variant="h5" fontWeight={700} color="primary">
          Rich Home
        </Typography>
      </Logo>

      {MenuItems.map((item) => {
        const Icon = item.icon || IconPoint
        const itemIcon = <Icon stroke={1.5} size="1.3rem" />

        if (item.navlabel) {
          return <Menu subHeading={item.subheader} key={item.id} />
        }

        return (
          <Box px={3} key={item.id}>
            <MenuItem
              isSelected={pathDirect === item.href}
              borderRadius="8px"
              icon={itemIcon}
              link={item.href}
              component={Link}
            >
              {item.title}
            </MenuItem>
          </Box>
        )
      })}
    </MUI_Sidebar>
  )
}

export default SidebarItems
