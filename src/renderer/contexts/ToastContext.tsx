import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { Snackbar, Alert, type AlertColor } from '@mui/material'

interface ToastContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showWarning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<AlertColor>('success')

  const show = useCallback((msg: string, sev: AlertColor) => {
    setMessage(msg)
    setSeverity(sev)
    setOpen(true)
  }, [])

  const showSuccess = useCallback((msg: string) => show(msg, 'success'), [show])
  const showError = useCallback((msg: string) => show(msg, 'error'), [show])
  const showWarning = useCallback((msg: string) => show(msg, 'warning'), [show])

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showWarning }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={3000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
