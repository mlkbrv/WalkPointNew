import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { supportAdminApi } from '@/api/endpoints';
import type { FAQEntry } from '@/api/types';
import { AsyncState, ConfirmDialog, PageHeader } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

export function FaqPage() {
  const { data, loading, error, reload } = useAsync(() => supportAdminApi.faq(), []);
  const [editing, setEditing] = useState<FAQEntry | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FAQEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [order, setOrder] = useState(0);

  const entries = data ?? [];

  function openEditor(entry: FAQEntry | 'new') {
    setEditing(entry);
    setQuestion(entry === 'new' ? '' : entry.question);
    setAnswer(entry === 'new' ? '' : entry.answer);
    setOrder(entry === 'new' ? entries.length + 1 : entry.sort_order);
  }

  async function act(work: Promise<unknown>) {
    setActionError(null);
    try {
      await work;
      setEditing(null);
      setDeleting(null);
      await reload();
    } catch (caught) {
      setActionError(describeError(caught));
    }
  }

  function save() {
    const payload = { question: question.trim(), answer: answer.trim(), category: '', sort_order: order };
    void act(
      editing === 'new'
        ? supportAdminApi.createFaq(payload)
        : supportAdminApi.updateFaq((editing as FAQEntry).id, payload),
    );
  }

  return (
    <>
      <PageHeader
        title="FAQ"
        subtitle="The app renders these instead of shipping its own answers."
        action={
          <Button variant="contained" onClick={() => openEditor('new')}>
            Add entry
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
        empty={entries.length === 0}
        emptyMessage="No FAQ entries yet. Run `python -m app.cli seed` or add one here."
      >
        <Stack spacing={1.5}>
          {entries.map((entry) => (
            <Paper key={entry.id} variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={600}>{entry.question}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {entry.answer}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => openEditor(entry)}>
                    Edit
                  </Button>
                  <IconButton size="small" color="error" onClick={() => setDeleting(entry)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </AsyncState>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'New FAQ entry' : 'Edit FAQ entry'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Question"
              fullWidth
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <TextField
              label="Answer"
              fullWidth
              multiline
              minRows={4}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
            <TextField
              label="Sort order"
              type="number"
              sx={{ width: 160 }}
              value={order}
              onChange={(event) => setOrder(Number(event.target.value))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={question.trim().length < 3 || answer.trim().length < 1}
            onClick={save}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this entry?"
        message={deleting?.question ?? ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && void act(supportAdminApi.deleteFaq(deleting.id))}
      />
    </>
  );
}