import { Alert, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { adminApi } from '@/api/endpoints';
import type { EconomySettings } from '@/api/types';
import { AsyncState, PageHeader } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

type FieldGroup = {
  title: string;
  note?: string;
  fields: { key: keyof EconomySettings; label: string; help?: string }[];
};

const GROUPS: FieldGroup[] = [
  {
    title: 'Steps to coins',
    note: 'A day below the threshold earns nothing at all — that is the product rule, not rounding.',
    fields: [
      { key: 'minimum_steps_threshold', label: 'Threshold (steps)' },
      { key: 'reward_at_threshold', label: 'Reward at threshold (coins)' },
      { key: 'reward_per_extra_thousand_steps', label: 'Per extra 1000 steps (coins)' },
    ],
  },
  {
    title: 'Anti-fraud',
    note: 'Days above the suspicion limit are flagged for review, never auto-blocked. The hard cap bounds what any single day can ever pay.',
    fields: [
      { key: 'suspicious_steps_per_day', label: 'Suspicious above (steps/day)' },
      { key: 'hard_cap_steps_per_day', label: 'Hard cap (steps/day)' },
      { key: 'max_steps_per_hour', label: 'Max plausible rate (steps/hour)' },
      { key: 'max_sync_age_days', label: 'Accept syncs up to (days old)' },
    ],
  },
  {
    title: 'Other rewards',
    fields: [
      { key: 'coins_per_story_view', label: 'Per story view (coins)' },
      { key: 'coins_per_referral', label: 'Per referral (coins)' },
      { key: 'referral_activity_steps_required', label: 'Referral unlocks after (steps)' },
    ],
  },
  {
    title: 'Stories',
    fields: [
      { key: 'story_lifetime_hours', label: 'Lifetime (hours)' },
      { key: 'max_stories_per_partner', label: 'Max active per partner' },
    ],
  },
];

export function EconomyPage() {
  const { data, loading, error, reload } = useAsync(() => adminApi.economy(), []);
  const [draft, setDraft] = useState<EconomySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty =
    draft !== null &&
    data !== null &&
    GROUPS.some((group) => group.fields.some((field) => draft[field.key] !== data[field.key]));

  async function save() {
    if (!draft || !data) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    // Send only what changed, so two people editing different numbers do not
    // overwrite each other's work.
    const changes: Partial<EconomySettings> = {};
    for (const group of GROUPS) {
      for (const field of group.fields) {
        if (draft[field.key] !== data[field.key]) changes[field.key] = draft[field.key];
      }
    }

    try {
      await adminApi.updateEconomy(changes);
      await reload();
      setSaved(true);
    } catch (caught) {
      setSaveError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Economy settings"
        subtitle="Live values. Changes apply to the next step sync — no deploy needed."
        action={
          <Stack direction="row" spacing={1}>
            <Button disabled={!dirty || saving} onClick={() => setDraft(data)}>
              Discard
            </Button>
            <Button variant="contained" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </Stack>
        }
      />

      <AsyncState loading={loading} error={error} empty={false}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}
        {saved && !dirty && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Saved.
          </Alert>
        )}

        <Stack spacing={3}>
          {GROUPS.map((group) => (
            <Paper key={group.title} variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {group.title}
              </Typography>
              {group.note && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {group.note}
                </Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {group.fields.map((field) => (
                  <TextField
                    key={String(field.key)}
                    label={field.label}
                    type="number"
                    size="small"
                    sx={{ width: 260 }}
                    value={draft?.[field.key] ?? ''}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, [field.key]: Number(event.target.value) }
                          : current,
                      )
                    }
                  />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </AsyncState>
    </>
  );
}
