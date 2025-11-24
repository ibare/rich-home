import { Box } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar as MUI_Sidebar,
  Logo,
  Menu,
  MenuItem,
} from 'react-mui-sidebar'
import { IconPoint } from '@tabler/icons-react'
import MenuItems from './MenuItems'
import titleImg from '@assets/title.png'

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
      <Box sx={{ mb: -2, ml: -1 }}>
        <Logo img="" component={Link} to="/">
          <img src={titleImg} alt="Rich Home" style={{ height: 68, marginTop: 10 }} />
        </Logo>
      </Box>

      {MenuItems.map((item) => {
        const Icon = item.icon || IconPoint
        const itemIcon = <Icon stroke={1.5} size="1.3rem" />

        if (item.navlabel) {
          return <Menu subHeading={item.subheader} key={item.id}/>
        }

        return (
          <Box px={2} key={item.id}>
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
