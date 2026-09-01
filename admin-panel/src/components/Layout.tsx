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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
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

import logo from '@/assets/logo.png';
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
    // First after the dashboard: this is the thing a business does every day,
    // standing at a counter with a customer waiting.
    { to: '/business/redeem', label: 'Redeem', icon: <QrCodeScannerIcon fontSize="small" /> },
    {
      to: '/business/coupons',
      label: 'Coupons',
      icon: <ConfirmationNumberIcon fontSize="small" />,
    },
    { to: '/business/stories', label: 'Stories', icon: <PhotoLibraryIcon fontSize="small" /> },
    {
      to: '/business/redemptions',
      label: 'History',
      icon: <ReceiptLongIcon fontSize="small" />,
    },
    { to: '/business/profile', label: 'Business profile', icon: <StoreIcon fontSize="small" /> },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* The two consoles are deliberately not the same surface. A moderator
          acting on someone else's business and a business acting on its own
          should never have to read a small chip to work out which one they are
          in, so the whole bar changes: dark and neutral for the console that
          moderates, brand violet for the one a partner owns. */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: 1,
          borderColor: isSuperadmin ? 'transparent' : 'divider',
          bgcolor: isSuperadmin ? '#111827' : 'primary.main',
          color: '#fff',
        }}
      >
        <Toolbar>
          <Box
            component="img"
            src={logo}
            alt=""
            sx={{ width: 28, height: 28, borderRadius: 1.2, mr: 1.25 }}
          />
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: 0.2 }}>
            Stepoint{' '}
            <Box component="span" sx={{ opacity: 0.62, fontWeight: 600 }}>
              {isSuperadmin ? 'Console' : 'for Business'}
            </Box>
          </Typography>
          <Chip
            size="small"
            label={isSuperadmin ? 'Модерация' : 'Партнёр'}
            sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 }}
          />
          <Typography variant="body2" sx={{ mr: 1, opacity: 0.85 }}>
            {user?.email}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton onClick={() => void signOut()} size="small" sx={{ color: '#fff' }}>
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
