import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#071a33', light: '#173d67', contrastText: '#fff' },
    secondary: { main: '#d61f2c', dark: '#a90d18', contrastText: '#fff' },
    background: { default: '#f7f9fc', paper: '#fff' },
    text: { primary: '#102033', secondary: '#5d6a78' },
    divider: '#e1e7ee',
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h1: { fontWeight: 900, letterSpacing: '-.045em' },
    h2: { fontWeight: 900, letterSpacing: '-.035em' },
    h3: { fontWeight: 850, letterSpacing: '-.025em' },
    button: { fontWeight: 800, textTransform: 'none' },
    body1: { lineHeight: 1.75 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 44, borderRadius: 10, paddingInline: 20, transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-1px)' } } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCssBaseline: { styleOverrides: { '*:focus-visible': { outline: '3px solid #ef8790', outlineOffset: 3 }, html: { scrollBehavior: 'smooth' } } },
  },
})
