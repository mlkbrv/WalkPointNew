import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { businessApi } from '@/api/endpoints';
import type { ScanPreview } from '@/api/types';
import { PageHeader } from '@/components/common';
import { describeError } from '@/components/useAsync';

/**
 * The till.
 *
 * Redemption used to live in the mobile app, where any signed-in user could
 * reach it — the navigator gated nothing — and where it did not work anyway: it
 * posted the voucher id to an endpoint that matches on `qr_token`. This is the
 * replacement, and it is where a business actually stands: at a counter, on a
 * browser.
 *
 * Two steps on purpose. `preview` reads a code without consuming it, so a
 * mistyped or already-used code costs nothing; only the explicit confirm calls
 * `scan`, which burns the voucher. That call is deliberately not idempotent —
 * a second attempt on the same voucher must fail.
 */

/** The customer's code is a UUID the server generated at purchase. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept what a person can realistically type off a phone screen.
 *
 * Someone reading a code aloud at a counter will lose the dashes, add spaces,
 * or use capitals. Rejecting that would be pedantry — the only thing that
 * matters is the 32 hex digits, so they are re-grouped rather than refused.
 */
function normaliseCode(input: string): string {
  const bare = input.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
  if (bare.length !== 32) return input.trim();
  return [
    bare.slice(0, 8),
    bare.slice(8, 12),
    bare.slice(12, 16),
    bare.slice(16, 20),
    bare.slice(20),
  ].join('-');
}

export function PartnerRedeemPage() {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<ScanPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function look() {
    const token = normaliseCode(code);
    setError(null);
    setDone(null);

    if (!UUID.test(token)) {
      setError('That does not look like a STRIDE code. It is 32 characters.');
      return;
    }

    setBusy(true);
    try {
      setPreview(await businessApi.previewCode(token));
      setCode(token);
    } catch (caught) {
      setPreview(null);
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await businessApi.redeemCode(normaliseCode(code));
      setDone(`${result.coupon_title} redeemed for ${result.customer_label}.`);
      setPreview(null);
      setCode('');
    } catch (caught) {
      // The usual failure is a race: someone redeemed it a moment ago.
      setError(describeError(caught));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setCode('');
    setError(null);
    setDone(null);
  }

  return (
    <>
      <PageHeader
        title="Redeem a coupon"
        subtitle="Type the code the customer shows you. Nothing is used up until you confirm."
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Paper variant="outlined" sx={{ p: 3, flex: 1, maxWidth: 560 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {done && <Alert severity="success">{done}</Alert>}

            <TextField
              label="Customer code"
              value={code}
              autoFocus
              disabled={busy || preview !== null}
              placeholder="0000aaaa-0000-4000-8000-000000000000"
              helperText="Dashes, spaces and capitals do not matter."
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                // A counter is a keyboard-only place; Enter has to work.
                if (event.key === 'Enter' && !preview) void look();
              }}
            />

            {preview === null ? (
              <Button
                variant="contained"
                size="large"
                disabled={busy || code.trim().length === 0}
                onClick={() => void look()}
              >
                {busy ? 'Checking…' : 'Check code'}
              </Button>
            ) : (
              <Stack spacing={1.5}>
                <Divider />
                <Typography variant="h6">{preview.coupon_title}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${preview.cost_paid} coins paid`} variant="outlined" />
                  <Chip
                    size="small"
                    label={`Valid until ${new Date(preview.valid_until).toLocaleDateString()}`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    color={preview.is_redeemable ? 'success' : 'default'}
                    label={preview.status}
                  />
                </Stack>

                {preview.is_redeemable ? (
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    disabled={busy}
                    onClick={() => void confirm()}
                  >
                    {busy ? 'Redeeming…' : 'Redeem now'}
                  </Button>
                ) : (
                  <Alert severity="warning">
                    {preview.status === 'used'
                      ? `Already redeemed${
                          preview.used_at
                            ? ` on ${new Date(preview.used_at).toLocaleString()}`
                            : ''
                        }.`
                      : 'This coupon has expired.'}
                  </Alert>
                )}

                <Button onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, width: { xs: '100%', md: 340 } }}>
          <Typography variant="subtitle2" gutterBottom>
            How this works
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1.25 } }}>
            <Typography component="li" variant="body2" color="text.secondary">
              The customer opens the coupon in their app and shows you the code
              underneath the QR.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              Type it in and press <strong>Check code</strong>. This only looks — nothing
              is used up, so a typo costs you nothing.
            </Typography>
            <Typography component="li" variant="body2" color="text.secondary">
              If it is valid, press <strong>Redeem now</strong>. That spends it, once and
              for good: a second attempt on the same code is refused.
            </Typography>
          </Box>
        </Paper>
      </Stack>
    </>
  );
}
