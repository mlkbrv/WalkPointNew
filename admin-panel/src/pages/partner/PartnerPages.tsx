/** The partner's dashboard, stories, redemption log, and business profile. */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { businessApi } from '@/api/endpoints';
import type { Partner } from '@/api/types';
import { AsyncState, PageHeader, StatCard, StatusChip, formatDate } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

export function PartnerDashboardPage() {
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([businessApi.profile(), businessApi.stats()]),
    [],
  );
  const [profile, stats] = data ?? [null, null];

  return (
    <>
      <PageHeader
        title={profile?.company_name ?? 'My business'}
        subtitle="How your offers are doing."
        action={<Button onClick={() => void reload()}>Refresh</Button>}
      />

      <AsyncState loading={loading} error={error} empty={false}>
        {profile && profile.status !== 'approved' && (
          <Alert severity={profile.status === 'suspended' ? 'error' : 'warning'} sx={{ mb: 3 }}>
            {profile.status === 'pending'
              ? 'Your business is awaiting approval. You can prepare drafts, but not submit them yet.'
              : `Your business is ${profile.status}. ${profile.rejection_reason}`}
          </Alert>
        )}

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <StatCard label="Live coupons" value={stats?.live_coupons ?? 0} />
          <StatCard label="Awaiting review" value={stats?.pending_coupons ?? 0} />
          <StatCard label="Live stories" value={stats?.live_stories ?? 0} />
          <StatCard
            label="Coupons bought"
            value={stats?.coupons_purchased ?? 0}
            hint="By app users"
          />
          <StatCard
            label="Redeemed"
            value={stats?.coupons_redeemed ?? 0}
            hint="Scanned at your counter"
          />
        </Stack>
      </AsyncState>
    </>
  );
}

export function PartnerStoriesPage() {
  const { data, loading, error, reload } = useAsync(() => businessApi.stories(), []);
  const [creating, setCreating] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [mediaPath, setMediaPath] = useState('');
  const [caption, setCaption] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const stories = data ?? [];

  async function act(work: Promise<unknown>) {
    setActionError(null);
    try {
      await work;
      setCreating(false);
      setMediaPath('');
      setCaption('');
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    }
  }

  return (
    <>
      <PageHeader
        title="Stories"
        subtitle="A story runs for 24 hours from the moment it is approved."
        action={
          <Button variant="contained" onClick={() => setCreating(true)}>
            New story
          </Button>
        }
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      <AsyncState
        loading={loading}
        error={error}
        empty={stories.length === 0}
        emptyMessage="No stories yet."
      >
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Caption</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stories.map((story) => (
                <TableRow key={story.id} hover>
                  <TableCell>
                    <Typography variant="body2">{story.caption || '—'}</Typography>
                    {story.status === 'rejected' && story.rejection_reason && (
                      <Typography variant="caption" color="error">
                        {story.rejection_reason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{story.media_type}</TableCell>
                  <TableCell>
                    <StatusChip status={story.status} />
                  </TableCell>
                  <TableCell>{formatDate(story.expires_at)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {(story.status === 'draft' || story.status === 'rejected') && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void act(businessApi.submitStory(story.id))}
                        >
                          Submit
                        </Button>
                      )}
                      {(story.status === 'pending' || story.status === 'approved') && (
                        <Button
                          size="small"
                          onClick={() => void act(businessApi.withdrawStory(story.id))}
                        >
                          Withdraw
                        </Button>
                      )}
                      {story.status !== 'approved' && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => void act(businessApi.deleteStory(story.id))}
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AsyncState>

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New story</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Media type"
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value)}
            >
              <MenuItem value="image">Image</MenuItem>
              <MenuItem value="video">Video</MenuItem>
            </TextField>
            <TextField
              label="Media path"
              placeholder="stories/summer-sale.jpg"
              helperText="Upload endpoint arrives with the media step; paste the stored key for now."
              value={mediaPath}
              onChange={(event) => setMediaPath(event.target.value)}
            />
            <TextField
              label="Caption"
              multiline
              minRows={3}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={mediaPath.trim().length === 0}
            onClick={() =>
              void act(
                businessApi.createStory({
                  media_type: mediaType,
                  media_path: mediaPath.trim(),
                  caption: caption.trim(),
                }),
              )
            }
          >
            Create draft
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function PartnerRedemptionsPage() {
  const { data, loading, error, reload } = useAsync(() => businessApi.redemptions(), []);
  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Redemptions"
        subtitle="Coupons scanned at your counter."
        action={<Button onClick={() => void reload()}>Refresh</Button>}
      />

      <AsyncState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyMessage="Nothing has been redeemed yet."
      >
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Coupon</TableCell>
                <TableCell>Paid</TableCell>
                <TableCell>Redeemed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.voucher_id} hover>
                  <TableCell>{row.coupon_title}</TableCell>
                  <TableCell>{row.cost_paid} coins</TableCell>
                  <TableCell>{formatDate(row.used_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AsyncState>
    </>
  );
}

export function PartnerProfilePage() {
  const { data, loading, error, reload } = useAsync(() => businessApi.profile(), []);
  const [draft, setDraft] = useState<Partial<Partner>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await businessApi.updateProfile({
        company_name: draft.company_name,
        description: draft.description,
        website: draft.website,
        contact_phone: draft.contact_phone,
      });
      await reload();
    } catch (caught) {
      setSaveError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Business profile"
        subtitle="What app users see on your store page."
        action={
          <Button variant="contained" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <AsyncState loading={loading} error={error} empty={false}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Status:
              </Typography>
              {data && <StatusChip status={data.status} />}
            </Stack>
            <TextField
              label="Company name"
              value={draft.company_name ?? ''}
              onChange={(event) => setDraft({ ...draft, company_name: event.target.value })}
            />
            <TextField
              label="Description"
              multiline
              minRows={4}
              value={draft.description ?? ''}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            <TextField
              label="Website"
              value={draft.website ?? ''}
              onChange={(event) => setDraft({ ...draft, website: event.target.value })}
            />
            <TextField
              label="Contact phone"
              value={draft.contact_phone ?? ''}
              onChange={(event) => setDraft({ ...draft, contact_phone: event.target.value })}
            />
          </Stack>
        </Paper>
      </AsyncState>
    </>
  );
}
