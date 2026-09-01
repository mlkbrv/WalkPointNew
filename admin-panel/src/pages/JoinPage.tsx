/**
 * The public landing page where a business applies to join.
 *
 * Reachable without a token — it is the one page in this panel that someone
 * with no account is supposed to see, so it has its own full-page layout rather
 * than living inside the signed-in `Layout`.
 *
 * The form posts to `/v1/partners/register`, which already creates the partner
 * in an unapproved state. That endpoint *is* the application: there is no
 * separate "lead" record to build, and inventing one would mean two places
 * where a prospective business can exist and a moderator has to look.
 *
 * Which is also why the success state is explicit that nothing is live yet. A
 * business that reads "account created" and then cannot find its coupons in the
 * app has been misled by the wording, not by the system.
 */

import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalActivityIcon from '@mui/icons-material/LocalActivity';
import InsightsIcon from '@mui/icons-material/Insights';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import logo from '../assets/logo.png';
import { onboardingApi } from '../api/endpoints';
import { ApiError } from '../api/client';

const SELLING_POINTS = [
  {
    icon: <LocalActivityIcon />,
    title: 'Публикуйте купоны',
    body: 'Заводите предложения сами: срок, количество, цена в шагах. Пользователи видят их в магазине приложения.',
  },
  {
    icon: <QrCodeScannerIcon />,
    title: 'Гасите на кассе',
    body: 'Клиент показывает код, кассир вводит его в панели. Камера не нужна, повторно погасить один код нельзя.',
  },
  {
    icon: <InsightsIcon />,
    title: 'Видите статистику',
    body: 'Сколько купонов взяли, сколько дошли до кассы, и когда именно.',
  },
];

export function JoinPage() {
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    contact_phone: '',
    password: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onboardingApi.registerPartner({
        email: form.email.trim(),
        password: form.password,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_phone: form.contact_phone.trim(),
        description: form.description.trim(),
      });
      setDone(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Не удалось отправить заявку. Попробуйте ещё раз.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
        <Card sx={{ maxWidth: 520 }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h5" fontWeight={800} gutterBottom>
              Заявка отправлена
            </Typography>
            <Typography color="text.secondary" paragraph>
              Аккаунт <b>{form.company_name}</b> создан, но пока не одобрен: ваши купоны
              не видны пользователям приложения, пока мы не проверим заявку.
            </Typography>
            <Typography color="text.secondary" paragraph>
              Войти в панель можно уже сейчас — с почтой <b>{form.email}</b> и паролем,
              который вы задали. После одобрения предложения появятся в магазине.
            </Typography>
            <Button component={RouterLink} to="/" variant="contained" size="large" sx={{ mt: 1 }}>
              Войти в панель
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          color: 'primary.contrastText',
          py: { xs: 6, md: 9 },
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
            <Box component="img" src={logo} alt="" sx={{ width: 52, height: 52, borderRadius: 2.2 }} />
            <Chip
              icon={<StorefrontIcon sx={{ color: 'inherit !important' }} />}
              label="Stepoint для бизнеса"
              sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: 'inherit', fontWeight: 700 }}
            />
          </Stack>
          <Typography variant="h3" fontWeight={800} sx={{ maxWidth: 720, lineHeight: 1.15 }}>
            Приводите покупателей за шаги, которые они и так делают
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 620, opacity: 0.92, fontSize: 18 }}>
            Пользователи Stepoint зарабатывают монеты, просто гуляя, и тратят их на купоны
            партнёров. Разместите своё предложение — платите только за реальные визиты.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <Grid container spacing={5}>
          <Grid item xs={12} md={6}>
            <Typography variant="h5" fontWeight={800} gutterBottom>
              Что вы получаете
            </Typography>
            <Stack spacing={3} sx={{ mt: 3 }}>
              {SELLING_POINTS.map((point) => (
                <Stack key={point.title} direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      flexShrink: 0,
                    }}
                  >
                    {point.icon}
                  </Box>
                  <Box>
                    <Typography fontWeight={700}>{point.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {point.body}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 4 }} />

            <Typography variant="body2" color="text.secondary">
              Уже партнёр?{' '}
              <Link component={RouterLink} to="/" fontWeight={700}>
                Войти в панель
              </Link>
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Typography variant="h6" fontWeight={800} gutterBottom>
                  Оставить заявку
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Заполните форму — мы проверим её и откроем доступ. Это займёт немного времени.
                </Typography>

                <Box component="form" onSubmit={onSubmit}>
                  <Stack spacing={2}>
                    <TextField
                      label="Название компании"
                      value={form.company_name}
                      onChange={set('company_name')}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Контактное лицо"
                      value={form.contact_name}
                      onChange={set('contact_name')}
                      fullWidth
                    />
                    <TextField
                      label="Рабочая почта"
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      required
                      fullWidth
                      helperText="С этой почтой вы будете входить в панель"
                    />
                    <TextField
                      label="Телефон"
                      value={form.contact_phone}
                      onChange={set('contact_phone')}
                      fullWidth
                    />
                    <TextField
                      label="Пароль"
                      type="password"
                      value={form.password}
                      onChange={set('password')}
                      required
                      fullWidth
                      helperText="Минимум 8 символов"
                    />
                    <TextField
                      label="Чем вы занимаетесь"
                      value={form.description}
                      onChange={set('description')}
                      fullWidth
                      multiline
                      minRows={3}
                    />

                    {error ? <Alert severity="error">{error}</Alert> : null}

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={submitting}
                    >
                      {submitting ? 'Отправляем…' : 'Отправить заявку'}
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
