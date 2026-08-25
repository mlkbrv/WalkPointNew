/** Small pieces every page reuses: status chips, async state, confirm/reason dialogs. */

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { ModerationStatus, PartnerStatus, TicketStatus } from '@/api/types';

const MODERATION_COLORS: Record<ModerationStatus, 'default' | 'warning' | 'success' | 'error'> = {
  draft: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

const PARTNER_COLORS: Record<PartnerStatus, 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  suspended: 'default',
};

export function StatusChip({ status }: { status: ModerationStatus | PartnerStatus | TicketStatus }) {
  const color =
    (MODERATION_COLORS as Record<string, 'default' | 'warning' | 'success' | 'error'>)[status] ??
    (PARTNER_COLORS as Record<string, 'default' | 'warning' | 'success' | 'error'>)[status] ??
    (status === 'open' ? 'warning' : 'default');

  return <Chip size="small" label={status} color={color} variant="outlined" />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

/**
 * Renders the three states every remote list has. Pages that skip the empty or
 * error branch are the ones that look broken when the API is slow or down.
 */
export function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (empty) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }
  return <>{children}</>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color={destructive ? 'error' : 'primary'}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Rejections must carry a reason — the API refuses a blank one, and the partner
 * reads what is typed here verbatim. The submit button stays disabled until
 * there is something worth sending.
 */
export function ReasonDialog({
  open,
  title,
  label = 'Reason',
  helperText = 'The partner sees this text exactly as written.',
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  label?: string;
  helperText?: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          margin="dense"
          label={label}
          helperText={helperText}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={reason.trim().length < 3}
          onClick={() => {
            onSubmit(reason.trim());
            setReason('');
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 160 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
