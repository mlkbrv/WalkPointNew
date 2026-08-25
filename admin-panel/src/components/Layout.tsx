/** App shell: role-aware navigation, the signed-in identity, and sign-out. */

import BarChartIcon from '@mui/icons-material/BarChart';
import CampaignIcon from '@mui/icons-material/Campaign';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import HelpIcon from '@mui/icons-material/Help';
import LogoutIcon from '@mui/icons-material/Logout';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SettingsIcon from '@mui/icons-material/Settings';
import StoreIcon from '@mui/icons-material/Store';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import {
  AppBar,
  Badge,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { adminApi } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/components/useAsync';

const DRAWER_WIDTH = 248;

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

function NavSection({ title, entries }: { title: string; entries: NavEntry[] }) {
  const location = useLocation();

  return (
    <>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 2.5, pt: 2, display: 'block' }}
      >
        {title}
      </Typography>
      <List dense>
        {entries.map((entry) => (
          <ListItemButton
            key={entry.to}
            component={NavLink}
            to={entry.to}
            selected={location.pathname.startsWith(entry.to)}
            sx={{ mx: 1, borderRadius: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 38 }}>
              <Badge badgeContent={entry.badge} color="error">
                {entry.icon}
              </Badge>
            </ListItemIcon>
            <ListItemText primary={entry.label} />
          </ListItemButton>
        ))}
      </List>
    </>
  );
}

export function Layout() {
  const { user, isSuperadmin, signOut } = useAuth();

  // Badge counts, so the reviewer sees where the work is without opening each page.
  const { data: queue } = useAsync(
    () => (isSuperadmin ? adminApi.queue() : Promise.resolve(null)),
    [isSuperadmin],
  );

  const adminEntries: NavEntry[] = [
    { to: '/admin', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
    {
      to: '/admin/partners',
      label: 'Partners',
      icon: <StoreIcon fontSize="small" />,
      badge: queue?.partners,
    },
    {
      to: '/admin/coupons',
      label: 'Coupons',
      icon: <ConfirmationNumberIcon fontSize="small" />,
      badge: queue?.coupons,
    },
    {
      to: '/admin/stories',
      label: 'Stories',
      icon: <PhotoLibraryIcon fontSize="small" />,
      badge: queue?.stories,
    },
    {
      to: '/admin/steps',
      label: 'Flagged steps',
      icon: <DirectionsWalkIcon fontSize="small" />,
      badge: queue?.flagged_steps,
    },
    {
      to: '/admin/support',
      label: 'Support',
      icon: <SupportAgentIcon fontSize="small" />,
      badge: queue?.support_tickets,
    },
    { to: '/admin/faq', label: 'FAQ', icon: <HelpIcon fontSize="small" /> },
    { to: '/admin/economy', label: 'Economy', icon: <SettingsIcon fontSize="small" /> },
    { to: '/admin/broadcast', label: 'Broadcast', icon: <CampaignIcon fontSize="small" /> },
  ];

  const partnerEntries: NavEntry[] = [
    { to: '/business', label: 'Dashboard', icon: <BarChartIcon fontSize="small" /> },
    {
      to: '/business/coupons',
      label: 'Coupons',
      icon: <ConfirmationNumberIcon fontSize="small" />,
    },
    { to: '/business/stories', label: 'Stories', icon: <PhotoLibraryIcon fontSize="small" /> },
    {
      to: '/business/redemptions',
      label: 'Redemptions',
      icon: <QrCodeScannerIcon fontSize="small" />,
    },
    { to: '/business/profile', label: 'Business profile', icon: <StoreIcon fontSize="small" /> },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>
            STRIDE
          </Typography>
          <Chip
            size="small"
            label={isSuperadmin ? 'Superadmin' : 'Partner'}
            color={isSuperadmin ? 'secondary' : 'primary'}
            sx={{ mr: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {user?.email}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton onClick={() => void signOut()} size="small">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          {isSuperadmin ? (
            <NavSection title="Moderation" entries={adminEntries} />
          ) : (
            <NavSection title="My business" entries={partnerEntries} />
          )}
          <Divider sx={{ mt: 2 }} />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 4, bgcolor: 'background.default' }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
