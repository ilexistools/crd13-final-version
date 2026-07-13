import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f7f8fa',
      paper: '#ffffff',
    },
    primary: {
      main: '#2457c5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#17806d',
    },
    text: {
      primary: '#172033',
      secondary: '#5d667a',
    },
    divider: '#dde3ee',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    h2: {
      fontSize: '1.35rem',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    h3: {
      fontSize: '1rem',
      fontWeight: 700,
      lineHeight: 1.35,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 600,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 38,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #dde3ee',
          boxShadow: '0 1px 2px rgba(20, 28, 45, 0.05)',
        },
      },
    },
  },
})
