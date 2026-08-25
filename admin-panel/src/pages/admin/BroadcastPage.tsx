import {
  Alert,
  Button,
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

export function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const audience = AUDIENCES.find((entry) => entry.value === role)?.label ?? '';

  async function send() {
    setConfirming(false);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await adminApi.broadcast(title.trim(), body.trim(), role || undefined);
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

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {result !== null && (
            <Alert severity="success">Delivered to {result} recipients.</Alert>
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
            label="Title"
            value={title}
            inputProps={{ maxLength: 150 }}
            helperText={`${title.length}/150 — this is the push headline`}
            onChange={(event) => setTitle(event.target.value)}
          />

          <TextField
            label="Message"
            multiline
            minRows={4}
            value={body}
            inputProps={{ maxLength: 500 }}
            helperText={`${body.length}/500`}
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

      <ConfirmDialog
        open={confirming}
        title="Send this to everyone?"
        message={`"${title.trim()}" goes to: ${audience}. This cannot be recalled.`}
        confirmLabel="Send"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => void send()}
      />
    </>
  );
}
