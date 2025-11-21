import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { ko } from 'date-fns/locale'
import App from './App'
import { theme } from './theme'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
        <CssBaseline />
        <App />
      </LocalizationProvider>
    </ThemeProvider>
  </React.StrictMode>
)
