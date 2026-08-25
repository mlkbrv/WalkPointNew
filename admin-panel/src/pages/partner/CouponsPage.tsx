/**
 * The partner's coupons.
 *
 * The lifecycle is the thing this page has to make legible: a draft is editable,
 * a submitted one is locked until review, and an approved one must be withdrawn
 * before it can change. Buttons appear and disappear to match, rather than being
 * shown and then failing on click.
 */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useState } from 'react';

import { businessApi } from '@/api/endpoints';
import type { Coupon } from '@/api/types';
import { AsyncState, ConfirmDialog, PageHeader, StatusChip, formatDate } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

function isoInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 16);
}

export function PartnerCouponsPage() {
  const { data, loading, error, reload } = useAsync(() => businessApi.coupons(), []);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(100);
  const [stock, setStock] = useState(50);
  const [startsAt, setStartsAt] = useState(isoInDays(0));
  const [endsAt, setEndsAt] = useState(isoInDays(30));

  const coupons = data ?? [];

  async function act(work: Promise<unknown>) {
    setActionError(null);
    try {
      await work;
      setCreating(false);
      setDeleting(null);
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    }
  }

  function create() {
    void act(
      businessApi.createCoupon({
        title: title.trim(),
        description: description.trim(),
        cost_coins: cost,
        quantity_total: stock,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      }),
    );
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Drafts are private. Submit one and a reviewer decides whether it goes live."
        action={
          <Button variant="contained" onClick={() => setCreating(true)}>
            New coupon
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
        empty={coupons.length === 0}
        emptyMessage="No coupons yet. Create one to get started."
      >
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Stock</TableCell>
                <TableCell>Runs until</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {coupon.title}
                    </Typography>
                    {coupon.status === 'rejected' && coupon.rejection_reason && (
                      <Typography variant="caption" color="error">
                        {coupon.rejection_reason}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={coupon.status} />
                  </TableCell>
                  <TableCell>{coupon.cost_coins} coins</TableCell>
                  <TableCell>
                    {coupon.quantity_redeemed} / {coupon.quantity_total}
                  </TableCell>
                  <TableCell>{formatDate(coupon.ends_at)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {(coupon.status === 'draft' || coupon.status === 'rejected') && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void act(businessApi.submitCoupon(coupon.id))}
                        >
                          Submit
                        </Button>
                      )}
                      {(coupon.status === 'pending' || coupon.status === 'approved') && (
                        <Button
                          size="small"
                          onClick={() => void act(businessApi.withdrawCoupon(coupon.id))}
                        >
                          Withdraw
                        </Button>
                      )}
                      {coupon.status !== 'approved' && (
                        <Button size="small" color="error" onClick={() => setDeleting(coupon)}>
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
        <DialogTitle>New coupon</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Price (coins)"
                type="number"
                value={cost}
                onChange={(event) => setCost(Number(event.target.value))}
              />
              <TextField
                label="How many available"
                type="number"
                value={stock}
                onChange={(event) => setStock(Number(event.target.value))}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Starts"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
              <TextField
                label="Ends"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={title.trim().length < 2 || cost < 1 || stock < 1}
            onClick={create}
          >
            Create draft
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this coupon?"
        message={
          'Coupons that people have already bought cannot be deleted — the server will refuse.'
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void act(businessApi.deleteCoupon(deleting.id))}
      />
    </>
  );
}
