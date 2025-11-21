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
      <ToolbarStyled>
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={toggleMobileSidebar}
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

        <Box flexGrow={1} />

        <Stack spacing={1} direction="row" alignItems="center">
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
