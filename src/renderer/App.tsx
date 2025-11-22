import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { styled, Container, Box } from '@mui/material'
import { PageProvider } from './contexts/PageContext'
import Sidebar from './components/layout/sidebar/Sidebar'
import Header from './components/layout/header/Header'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import MonthlyClosing from './pages/MonthlyClosing'
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
  height: '100vh',
  width: '100%',
  overflow: 'hidden',
}))

const PageWrapper = styled('div')(({ theme }) => ({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  zIndex: 1,
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
  minWidth: 0,
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

            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                paddingBottom: '60px',
                // 스크롤바 기본 숨김, 호버 시 표시
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'transparent',
                  borderRadius: '4px',
                  transition: 'background 0.2s',
                },
                '&:hover::-webkit-scrollbar-thumb': {
                  background: 'rgba(0, 0, 0, 0.2)',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                  background: 'rgba(0, 0, 0, 0.3)',
                },
                // Firefox
                scrollbarWidth: 'thin',
                scrollbarColor: 'transparent transparent',
                '&:hover': {
                  scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
                },
              }}
            >
              <Container
                sx={{
                  paddingTop: '20px',
                  paddingBottom: '40px',
                  maxWidth: '1200px',
                }}
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/monthly-closing" element={<MonthlyClosing />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/accounts/:accountId" element={<AccountBalanceHistory />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/liabilities" element={<Liabilities />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/budget" element={<Budget />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Container>
            </Box>
          </PageWrapper>
        </MainWrapper>
      </PageProvider>
    </HashRouter>
  )
}

export default App
