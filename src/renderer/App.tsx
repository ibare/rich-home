import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Categories from './pages/Categories'
import Budget from './pages/Budget'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'

const DRAWER_WIDTH = 240

function App() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  return (
    <HashRouter>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar
          drawerWidth={DRAWER_WIDTH}
          mobileOpen={mobileOpen}
          onDrawerToggle={handleDrawerToggle}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { sm: `${DRAWER_WIDTH}px` },
            height: '100vh',
            overflow: 'auto',
            backgroundColor: 'background.default',
          }}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Box>
      </Box>
    </HashRouter>
  )
}

export default App
