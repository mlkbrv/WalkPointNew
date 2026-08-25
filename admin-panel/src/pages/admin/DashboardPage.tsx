import { Alert, Button, Stack } from '@mui/material';
import { Link } from 'react-router-dom';

import { adminApi, supportAdminApi } from '@/api/endpoints';
import { AsyncState, PageHeader, StatCard } from '@/components/common';
import { useAsync } from '@/components/useAsync';

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([adminApi.queue(), supportAdminApi.counts()]),
    [],
  );

  const [queue, support] = data ?? [null, null];
  const outstanding =
    (queue?.partners ?? 0) + (queue?.coupons ?? 0) + (queue?.stories ?? 0) + (queue?.flagged_steps ?? 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Everything waiting on a decision."
        action={<Button onClick={() => void reload()}>Refresh</Button>}
      />

      <AsyncState loading={loading} error={error} empty={false}>
        {outstanding === 0 && (support?.awaiting_reply ?? 0) === 0 && (
          <Alert severity="success" sx={{ mb: 3 }}>
            The queue is clear.
          </Alert>
        )}

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <StatCard label="Partners" value={queue?.partners ?? 0} hint="Awaiting approval" />
          <StatCard label="Coupons" value={queue?.coupons ?? 0} hint="Awaiting review" />
          <StatCard label="Stories" value={queue?.stories ?? 0} hint="Awaiting review" />
          <StatCard
            label="Flagged steps"
            value={queue?.flagged_steps ?? 0}
            hint="Coins withheld pending review"
          />
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard
            label="Support"
            value={support?.awaiting_reply ?? 0}
            hint={`${support?.open_tickets ?? 0} open threads`}
          />
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 4 }} flexWrap="wrap" useFlexGap>
          <Button component={Link} to="/admin/partners" variant="outlined">
            Review partners
          </Button>
          <Button component={Link} to="/admin/coupons" variant="outlined">
            Review coupons
          </Button>
          <Button component={Link} to="/admin/steps" variant="outlined">
            Review flagged steps
          </Button>
          <Button component={Link} to="/admin/support" variant="outlined">
            Answer support
          </Button>
        </Stack>
      </AsyncState>
    </>
  );
}
