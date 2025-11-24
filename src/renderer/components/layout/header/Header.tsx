import {
  Box,
  AppBar,
  Toolbar,
  styled,
  Stack,
  IconButton,
  Typography,
} from '@mui/material'
import { IconMenu2, IconPlus } from '@tabler/icons-react'
import { usePageContext } from '../../../contexts/PageContext'

interface HeaderProps {
  toggleMobileSidebar: () => void
}

const Header = ({ toggleMobileSidebar }: HeaderProps) => {
  const { pageTitle, onAdd } = usePageContext()

  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    boxShadow: 'none',
    background: theme.palette.background.paper,
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    paddingTop: '20px',
    [theme.breakpoints.up('lg')]: {
      minHeight: '70px',
    },
  }))

  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: '100%',
    color: theme.palette.text.secondary,
  }))

  return (
    <AppBarStyled position="sticky" color="default">
      {/* 드래그 영역 (macOS 타이틀바) */}
      <Box
        className="drag-region"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '20px',
        }}
      />
      <ToolbarStyled>
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={toggleMobileSidebar}
          className="no-drag"
          sx={{
            display: {
              lg: 'none',
              xs: 'inline',
            },
          }}
        >
          <IconMenu2 width="20" height="20" />
        </IconButton>

        <Typography variant="h5" fontWeight={600} color="text.primary" sx={{ ml: 1 }}>
          {pageTitle}
        </Typography>

        <Box flexGrow={1} className="drag-region" sx={{ height: '100%' }} />

        <Stack spacing={1} direction="row" alignItems="center" className="no-drag">
          {onAdd && (
            <IconButton
              color="primary"
              aria-label="add"
              onClick={onAdd}
              sx={{
                backgroundColor: 'primary.light',
                '&:hover': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                },
              }}
            >
              <IconPlus size="20" />
            </IconButton>
          )}
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  )
}

export default Header
