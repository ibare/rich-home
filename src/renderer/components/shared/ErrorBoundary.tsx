import { Component, type ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            오류가 발생했습니다
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {this.state.error?.message}
          </Typography>
          <Button variant="outlined" onClick={this.handleReset}>
            다시 시도
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}
