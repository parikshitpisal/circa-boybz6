import { createTheme, ThemeOptions } from '@mui/material/styles';  // @mui/material v5.x

export const darkTheme: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',      // WCAG AA compliant with dark background
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    secondary: {
      main: '#f48fb1',      // WCAG AA compliant with dark background
      light: '#fce4ec',
      dark: '#f06292',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    background: {
      default: '#121212',    // Material Design dark theme recommended background
      paper: '#1e1e1e',     // Elevated surface color
      elevated: '#242424',   // Higher elevation surface color
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.87)',    // High emphasis text - WCAG AA compliant
      secondary: 'rgba(255, 255, 255, 0.6)',    // Medium emphasis text
      disabled: 'rgba(255, 255, 255, 0.38)',    // Disabled text
    },
    error: {
      main: '#f44336',      // WCAG AA compliant error color
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ffa726',      // WCAG AA compliant warning color
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    success: {
      main: '#66bb6a',      // WCAG AA compliant success color
      light: '#81c784',
      dark: '#388e3c',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',      // Low emphasis separator
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',    // System font stack
    fontSize: 16,                               // Base font size
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
      lineHeight: 1.3,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: '0em',
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
      letterSpacing: '0.01071em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.75,
      letterSpacing: '0.02857em',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          textTransform: 'none',
          padding: '8px 16px',
          transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          borderRadius: '8px',
          boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        },
      },
    },
  },
  shape: {
    borderRadius: 4,
  },
  spacing: 8,
};

export default darkTheme;