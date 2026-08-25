/**
 * The three moderation queues. They share one shape — a list of pending items,
 * approve, and reject-with-a-reason — so they share one component and differ only
 * in what they load and how a row reads.
 */

import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { adminApi } from '@/api/endpoints';
import type { Coupon, FlaggedDay, Partner, Story } from '@/api/types';
import { AsyncState, PageHeader, ReasonDialog, formatDate } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

interface QueueColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
}

function ReviewQueue<T>({
  title,
  subtitle,
  emptyMessage,
  columns,
  rowId,
  load,
  approve,
  reject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  rejectTitle = 'Reject with a reason',
}: {
  title: string;
  subtitle: string;
  emptyMessage: string;
  columns: QueueColumn<T>[];
  rowId: (row: T) => string;
  load: () => Promise<T[]>;
  approve: (id: string) => Promise<unknown>;
  reject: (id: string, reason: string) => Promise<unknown>;
  approveLabel?: string;
  rejectLabel?: string;
  rejectTitle?: string;
}) {
  const { data, loading, error, reload } = useAsync(load, []);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = data ?? [];

  async function act(work: Promise<unknown>) {
    setActionError(null);
    try {
      await work;
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={<Button onClick={() => void reload()}>Refresh</Button>}
      />

      <AsyncState
        loading={loading}
        error={error ?? actionError}
        empty={rows.length === 0}
        emptyMessage={emptyMessage}
      >
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column.label}>{column.label}</TableCell>
                ))}
                <TableCell align="right">Decision</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowId(row)} hover>
                  {columns.map((column) => (
                    <TableCell key={column.label}>{column.render(row)}</TableCell>
                  ))}
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void act(approve(rowId(row)))}
                      >
                        {approveLabel}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setRejecting(rowId(row))}
                      >
                        {rejectLabel}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AsyncState>

      <ReasonDialog
        open={rejecting !== null}
        title={rejectTitle}
        onCancel={() => setRejecting(null)}
        onSubmit={(reason) => {
          const id = rejecting;
          setRejecting(null);
          if (id) void act(reject(id, reason));
        }}
      />
    </>
  );
}

export function PartnersQueuePage() {
  return (
    <ReviewQueue<Partner>
      title="Partner applications"
      subtitle="Approving a business lets it publish. Its coupons and stories still need their own review."
      emptyMessage="No businesses are waiting for approval."
      rowId={(row) => row.id}
      load={adminApi.pendingPartners}
      approve={adminApi.approvePartner}
      reject={adminApi.rejectPartner}
      rejectTitle="Reject this application"
      columns={[
        { label: 'Business', render: (row) => <strong>{row.company_name}</strong> },
        { label: 'Contact', render: (row) => row.contact_email || row.contact_phone || '—' },
        {
          label: 'Description',
          render: (row) => (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 320 }}>
              {row.description || '—'}
            </Typography>
          ),
        },
        { label: 'Applied', render: (row) => formatDate(row.created_at) },
      ]}
    />
  );
}

export function CouponsQueuePage() {
  return (
    <ReviewQueue<Coupon>
      title="Coupons awaiting review"
      subtitle="Approved coupons go live in the app immediately."
      emptyMessage="No coupons are waiting for review."
      rowId={(row) => row.id}
      load={adminApi.pendingCoupons}
      approve={adminApi.approveCoupon}
      reject={adminApi.rejectCoupon}
      rejectTitle="Send this coupon back"
      columns={[
        { label: 'Title', render: (row) => <strong>{row.title}</strong> },
        { label: 'Price', render: (row) => `${row.cost_coins} coins` },
        { label: 'Stock', render: (row) => row.quantity_total },
        {
          label: 'Runs',
          render: (row) => `${formatDate(row.starts_at)} → ${formatDate(row.ends_at)}`,
        },
      ]}
    />
  );
}

export function StoriesQueuePage() {
  return (
    <ReviewQueue<Story>
      title="Stories awaiting review"
      subtitle="A story's lifetime starts when you approve it, not when it was written."
      emptyMessage="No stories are waiting for review."
      rowId={(row) => row.id}
      load={adminApi.pendingStories}
      approve={adminApi.approveStory}
      reject={adminApi.rejectStory}
      rejectTitle="Send this story back"
      columns={[
        { label: 'Media', render: (row) => row.media_type },
        {
          label: 'Caption',
          render: (row) => (
            <Typography variant="body2" noWrap sx={{ maxWidth: 380 }}>
              {row.caption || '—'}
            </Typography>
          ),
        },
        { label: 'Submitted', render: (row) => formatDate(row.created_at) },
      ]}
    />
  );
}

export function FlaggedStepsPage() {
  return (
    <ReviewQueue<FlaggedDay>
      title="Flagged step days"
      subtitle="Coins are withheld until you decide. Rejecting does not block the account."
      emptyMessage="Nothing is flagged. No coins are being withheld."
      rowId={(row) => row.day_id}
      load={adminApi.flaggedDays}
      approve={adminApi.approveFlaggedDay}
      reject={adminApi.rejectFlaggedDay}
      approveLabel="Release coins"
      rejectLabel="Discard"
      rejectTitle="Discard this day"
      columns={[
        { label: 'User', render: (row) => row.user_label },
        { label: 'Date', render: (row) => row.date },
        { label: 'Steps', render: (row) => row.steps.toLocaleString() },
        { label: 'Withheld', render: (row) => `${row.coins_pending} coins` },
        {
          label: 'Why flagged',
          render: (row) => (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {row.reason}
            </Typography>
          ),
        },
      ]}
    />
  );
}
