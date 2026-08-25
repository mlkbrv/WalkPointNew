import { createTheme } from '@mui/material/styles';

/** Brand colours lifted from the mobile app's theme, so the two feel related. */
export const theme = createTheme({
  palette: {
    primary: { main: '#8140F3' },
    secondary: { main: '#FF6B52' },
    success: { main: '#00A56D' },
    background: { default: '#F8F9FB', paper: '#FFFFFF' },
    text: { primary: '#121417', secondary: '#64748B' },
    divider: '#E8EAF0',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
