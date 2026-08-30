/**
 * Routing.
 *
 * A partner never receives the superadmin routes and vice versa — the two role
 * trees are mounted separately, so an unknown path lands on the caller's own home
 * rather than a page they would be refused.
 */

import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { BroadcastPage } from '@/pages/admin/BroadcastPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { EconomyPage } from '@/pages/admin/EconomyPage';
import { FaqPage } from '@/pages/admin/FaqPage';
import {
  CouponsQueuePage,
  FlaggedStepsPage,
  PartnersQueuePage,
  StoriesQueuePage,
} from '@/pages/admin/ModerationPages';
import { SupportPage } from '@/pages/admin/SupportPage';
import { PartnerCouponsPage } from '@/pages/partner/CouponsPage';
import {
  PartnerDashboardPage,
  PartnerProfilePage,
  PartnerRedemptionsPage,
  PartnerStoriesPage,
} from '@/pages/partner/PartnerPages';
import { PartnerRedeemPage } from '@/pages/partner/RedeemPage';

export function App() {
  const { user, loading, isSuperadmin } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  const home = isSuperadmin ? '/admin' : '/business';

  return (
    <Routes>
      <Route element={<Layout />}>
        {isSuperadmin ? (
          <>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/partners" element={<PartnersQueuePage />} />
            <Route path="/admin/coupons" element={<CouponsQueuePage />} />
            <Route path="/admin/stories" element={<StoriesQueuePage />} />
            <Route path="/admin/steps" element={<FlaggedStepsPage />} />
            <Route path="/admin/support" element={<SupportPage />} />
            <Route path="/admin/faq" element={<FaqPage />} />
            <Route path="/admin/economy" element={<EconomyPage />} />
            <Route path="/admin/broadcast" element={<BroadcastPage />} />
          </>
        ) : (
          <>
            <Route path="/business" element={<PartnerDashboardPage />} />
            <Route path="/business/coupons" element={<PartnerCouponsPage />} />
            <Route path="/business/stories" element={<PartnerStoriesPage />} />
            <Route path="/business/redeem" element={<PartnerRedeemPage />} />
            <Route path="/business/redemptions" element={<PartnerRedemptionsPage />} />
            <Route path="/business/profile" element={<PartnerProfilePage />} />
          </>
        )}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
