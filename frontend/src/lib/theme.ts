'use client';
import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/Chip' {
  interface ChipPropsVariantOverrides {
    soft: true;
  }
}


const theme = createTheme({
  palette: {
    mode: 'light', // We can toggle this if needed
    primary: {
      main: '#2563eb', // Indigo Blue
      dark: '#1d4ed8',
      light: '#60a5fa',
    },
    secondary: {
      main: '#64748b', // Slate
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: 'var(--font-inter), sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 800, tracking: '-0.02em' },
    h2: { fontSize: '2rem', fontWeight: 700, tracking: '-0.01em' },
    h3: { fontSize: '1.5rem', fontWeight: 700 },
    h4: { fontSize: '1.25rem', fontWeight: 600 },
    h5: { fontSize: '1.1rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.75rem', lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)',
          },
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8, #1e40af)',
            },
          },
        },
      ],
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.02)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0c1220', // Dark Sidebar
          color: 'rgba(255, 255, 255, 0.7)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
      variants: [
        {
          props: { variant: 'soft', color: 'primary' },
          style: {
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            color: '#2563eb',
            border: 'none',
          },
        },
        {
          props: { variant: 'soft', color: 'secondary' },
          style: {
            backgroundColor: 'rgba(100, 116, 139, 0.1)',
            color: '#64748b',
            border: 'none',
          },
        },
        {
          props: { variant: 'soft', color: 'error' },
          style: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: 'none',
          },
        },
        {
          props: { variant: 'soft', color: 'info' },
          style: {
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            color: '#0ea5e9',
            border: 'none',
          },
        },
        {
          props: { variant: 'soft', color: 'success' },
          style: {
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            color: '#22c55e',
            border: 'none',
          },
        },
        {
          props: { variant: 'soft', color: 'warning' },
          style: {
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            border: 'none',
          },
        },
      ],
    },

  },
});

export default theme;
