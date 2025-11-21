import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { styled, Container, Box } from '@mui/material'
import { PageProvider } from './contexts/PageContext'
import Sidebar from './components/layout/sidebar/Sidebar'
import Header from './components/layout/header/Header'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import AccountBalanceHistory from './pages/AccountBalanceHistory'
import Assets from './pages/Assets'
import Liabilities from './pages/Liabilities'
import Categories from './pages/Categories'
import Budget from './pages/Budget'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'

const MainWrapper = styled('div')(() => ({
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
}))

const PageWrapper = styled('div')(({ theme }) => ({
  display: 'flex',
  flexGrow: 1,
  paddingBottom: '60px',
  flexDirection: 'column',
  zIndex: 1,
  backgroundColor: theme.palette.background.paper,
}))

function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <HashRouter>
      <PageProvider>
        <MainWrapper>
          <Sidebar
            isSidebarOpen={isSidebarOpen}
            isMobileSidebarOpen={isMobileSidebarOpen}
            onSidebarClose={() => setMobileSidebarOpen(false)}
          />

          <PageWrapper>
            <Header toggleMobileSidebar={() => setMobileSidebarOpen(true)} />

            <Container
              sx={{
                paddingTop: '20px',
                maxWidth: '1200px',
              }}
            >
              <Box sx={{ minHeight: 'calc(100vh - 170px)' }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/:accountId" element={<AccountBalanceHistory />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/liabilities" element={<Liabilities />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/budget" element={<Budget />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Box>
            </Container>
          </PageWrapper>
        </MainWrapper>
      </PageProvider>
    </HashRouter>
  )
}

export default App
