/** The support console: ticket list on the left, the conversation on the right. */

import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { supportAdminApi } from '@/api/endpoints';
import type { StaffThread, TicketStatus } from '@/api/types';
import { AsyncState, PageHeader, StatusChip, formatDate } from '@/components/common';
import { describeError, useAsync } from '@/components/useAsync';

function Bubble({ mine, body, at }: { mine: boolean; body: string; at: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', mb: 1.5 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          maxWidth: '75%',
          bgcolor: mine ? 'primary.main' : 'background.paper',
          color: mine ? 'primary.contrastText' : 'text.primary',
          borderColor: mine ? 'primary.main' : 'divider',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {body}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
          {formatDate(at)}
        </Typography>
      </Paper>
    </Box>
  );
}

export function SupportPage() {
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<StaffThread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const {
    data: page,
    loading,
    error,
    reload,
  } = useAsync(
    () => supportAdminApi.tickets(filter === 'all' ? undefined : filter),
    [filter],
  );

  const tickets = page?.items ?? [];

  useEffect(() => {
    if (!selected) {
      setThread(null);
      return;
    }
    let cancelled = false;
    setThreadError(null);
    supportAdminApi
      .thread(selected)
      .then((data) => {
        if (!cancelled) setThread(data);
      })
      .catch((caught) => {
        if (!cancelled) setThreadError(describeError(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function act(work: Promise<unknown>) {
    setBusy(true);
    setThreadError(null);
    try {
      await work;
      if (selected) setThread(await supportAdminApi.thread(selected));
      await reload();
    } catch (caught) {
      setThreadError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || !selected) return;
    setDraft('');
    await act(supportAdminApi.reply(selected, body));
  }

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Answer users. A reply also pushes them a short preview."
        action={<Button onClick={() => void reload()}>Refresh</Button>}
      />

      <Tabs
        value={filter}
        onChange={(_, value) => {
          setFilter(value);
          setSelected(null);
        }}
        sx={{ mb: 2 }}
      >
        <Tab value="open" label="Open" />
        <Tab value="closed" label="Closed" />
        <Tab value="all" label="All" />
      </Tabs>

      <Stack direction="row" spacing={2} alignItems="stretch" sx={{ height: '68vh' }}>
        <Paper variant="outlined" sx={{ width: 340, overflow: 'auto', flexShrink: 0 }}>
          <AsyncState
            loading={loading}
            error={error}
            empty={tickets.length === 0}
            emptyMessage="No conversations here."
          >
            <List dense disablePadding>
              {tickets.map((ticket) => (
                <ListItemButton
                  key={ticket.id}
                  selected={ticket.id === selected}
                  onClick={() => setSelected(ticket.id)}
                  divider
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                          {ticket.user_label}
                        </Typography>
                        {ticket.awaiting_reply && (
                          <Chip size="small" color="error" label="waiting" />
                        )}
                      </Stack>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" noWrap display="block">
                          {ticket.subject || '(no subject)'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {ticket.message_count} messages · {formatDate(ticket.last_message_at)}
                        </Typography>
                      </>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </AsyncState>
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!thread ? (
            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">Pick a conversation.</Typography>
            </Box>
          ) : (
            <>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ p: 2 }}
              >
                <Box>
                  <Typography fontWeight={700}>{thread.user_label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Opened {formatDate(thread.created_at)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StatusChip status={thread.status} />
                  {thread.status === 'open' ? (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => void act(supportAdminApi.close(thread.ticket_id))}
                    >
                      Close
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => void act(supportAdminApi.reopen(thread.ticket_id))}
                    >
                      Reopen
                    </Button>
                  )}
                </Stack>
              </Stack>
              <Divider />

              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {threadError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {threadError}
                  </Alert>
                )}
                {thread.messages.map((message) => (
                  <Bubble
                    key={message.id}
                    mine={message.sender === 'admin'}
                    body={message.body}
                    at={message.created_at}
                  />
                ))}
              </Box>

              <Divider />
              <Stack direction="row" spacing={1} sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={4}
                  placeholder={
                    thread.status === 'closed' ? 'Reopen the ticket to reply.' : 'Write a reply…'
                  }
                  disabled={thread.status === 'closed' || busy}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  endIcon={<SendIcon />}
                  disabled={thread.status === 'closed' || busy || !draft.trim()}
                  onClick={() => void send()}
                >
                  Send
                </Button>
              </Stack>
            </>
          )}
        </Paper>
      </Stack>
    </>
  );
}
