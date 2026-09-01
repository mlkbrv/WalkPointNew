import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { adminApi } from '@/api/endpoints';
import { ConfirmDialog, PageHeader } from '@/components/common';
import { describeError } from '@/components/useAsync';

const AUDIENCES = [
  { value: '', label: 'Everyone active' },
  { value: 'user', label: 'App users only' },
  { value: 'partner', label: 'Partners only' },
];

/**
 * Where tapping the notification lands.
 *
 * These are the values the app's `routeForNotification` knows. Anything else it
 * does not recognise opens the inbox, so an unlisted value degrades rather than
 * dead-ends — but there is no reason to offer one.
 */
const DESTINATIONS = [
  { value: 'generic', label: 'Inbox', hint: 'The notification list. The safe default.' },
  { value: 'coins_awarded', label: 'Wallet', hint: 'Balance and vouchers.' },
  { value: 'new_coupon', label: 'Store', hint: 'The rewards catalogue.' },
  { value: 'steps_missed', label: 'Home', hint: "Today's ring and step total." },
  {
    value: 'moderation_result',
    label: 'Merchant manager',
    hint: 'Partner-only — app users land on the inbox instead.',
  },
];

/** A lock-screen notification, at roughly the proportions Android draws one. */
function PushPreview({ title, body }: { title: string; body: string }) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        p: 2,
        // A neutral dark ground: a lock screen is a photo, and this is the
        // scrim the system draws over it.
        bgcolor: '#1F232B',
        color: '#F2F4F8',
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: '#8140F3',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        S
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 11, opacity: 0.6, letterSpacing: 0.4 }}>
          Stepoint · now
        </Typography>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 700,
            mt: 0.25,
            // Android truncates the headline to one line on the lock screen.
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title.trim() || 'Your title appears here'}
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            opacity: 0.8,
            mt: 0.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {body.trim() || 'And the message body here — two lines before it is cut.'}
        </Typography>
      </Box>
    </Box>
  );
}

export function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [destination, setDestination] = useState('generic');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audience = AUDIENCES.find((entry) => entry.value === role)?.label ?? '';
  const target = DESTINATIONS.find((entry) => entry.value === destination);

  /**
   * Android shows roughly this much on the lock screen before truncating. The
   * message is not rejected past it — the rest simply is not read.
   */
  const titleTruncates = title.trim().length > 45;
  const bodyTruncates = body.trim().length > 120;

  async function send() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await adminApi.broadcast({
        title: title.trim(),
        body: body.trim(),
        role: role || undefined,
        notification_type: destination,
      });
      setResult(response.recipients);
      setTitle('');
      setBody('');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Broadcast"
        subtitle="One message to every recipient's inbox, plus a push. There is no undo."
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Paper variant="outlined" sx={{ p: 3, flex: 1, maxWidth: 640 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {result !== null && (
              <Alert severity="success">
                Written to {result} {result === 1 ? 'inbox' : 'inboxes'}. Devices with
                push enabled also received it.
              </Alert>
            )}

            <TextField
              select
              label="Audience"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {AUDIENCES.map((entry) => (
                <MenuItem key={entry.value} value={entry.value}>
                  {entry.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Opens"
              value={destination}
              helperText={target?.hint}
              onChange={(event) => setDestination(event.target.value)}
            >
              {DESTINATIONS.map((entry) => (
                <MenuItem key={entry.value} value={entry.value}>
                  {entry.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Title"
              value={title}
              inputProps={{ maxLength: 150 }}
              error={titleTruncates}
              helperText={
                titleTruncates
                  ? `${title.length}/150 — past ~45 characters the lock screen cuts it off`
                  : `${title.length}/150 — this is the push headline`
              }
              onChange={(event) => setTitle(event.target.value)}
            />

            <TextField
              label="Message"
              multiline
              minRows={4}
              value={body}
              inputProps={{ maxLength: 500 }}
              error={bodyTruncates}
              helperText={
                bodyTruncates
                  ? `${body.length}/500 — only about the first 120 show before the fold`
                  : `${body.length}/500`
              }
              onChange={(event) => setBody(event.target.value)}
            />

            <Typography variant="body2" color="text.secondary">
              Blocked and deactivated accounts are excluded automatically.
            </Typography>

            <Button
              variant="contained"
              size="large"
              disabled={busy || title.trim().length === 0}
              onClick={() => setConfirming(true)}
            >
              {busy ? 'Sending…' : 'Send broadcast'}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, width: { xs: '100%', md: 360 } }}>
          <Typography variant="subtitle2" gutterBottom>
            Preview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How it arrives on a locked phone.
          </Typography>

          <PushPreview title={title} body={body} />

          <Divider sx={{ my: 2.5 }} />

          <Stack spacing={1.25}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Goes to
              </Typography>
              <Typography variant="body2">{audience}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Tapping opens
              </Typography>
              <Typography variant="body2">{target?.label}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Delivery
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Chip size="small" label="In-app inbox" color="success" variant="outlined" />
                <Chip size="small" label="Push (if enabled)" variant="outlined" />
              </Stack>
            </Box>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            The inbox row is written for everyone in the audience and is the durable
            record. Push reaches only devices that registered a token and still have
            notifications allowed, so the two counts will not match.
          </Typography>
        </Paper>
      </Stack>

      <ConfirmDialog
        open={confirming}
        title="Send this to everyone?"
        message={`"${title.trim()}" goes to: ${audience}. Tapping it opens ${target?.label}. This cannot be recalled.`}
        confirmLabel="Send"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => void send()}
      />
    </>
  );
}
