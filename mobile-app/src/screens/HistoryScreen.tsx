/**
 * History: every recorded session, grouped under the day it happened.
 *
 * Grouping is by **local** date taken from `finished_at`, falling back to
 * `started_at` for a session that was never closed. The server sends UTC
 * timestamps, so grouping on the raw string would file an evening walk under
 * the following day for anyone east of Greenwich.
 *
 * The reference has swipe-to-delete on these rows. It is deliberately not here:
 * the API exposes no delete for a workout (`/v1/workouts` has post, patch,
 * finish and three reads, and nothing else), so the gesture could only ever
 * have hidden the row locally and let it return on the next refresh.
 */

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "../api/client";
import { workoutsApi, type ApiWorkout } from "../api/endpoints";
import { formatDuration } from "../contexts/StrideContext";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { localDateKey } from "../health/dates";
import { spacing } from "../theme";
import type { Palette } from "../theme";

const PAGE = 50;

/**
 * "Today", "Yesterday", or a written-out date.
 *
 * Takes the two relative labels as arguments rather than reaching for the
 * translation itself: it is a plain function outside the component tree, so it
 * cannot call a hook.
 */
function groupTitle(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const today = localDateKey(new Date());
  const yesterday = localDateKey(new Date(Date.now() - 86_400_000));
  if (iso === today) return todayLabel;
  if (iso === yesterday) return yesterdayLabel;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Metric({
  icon,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  tint: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={13} color={tint} />
      <Text style={styles.metricText}>{value}</Text>
    </View>
  );
}

export function HistoryScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation<{ goBack: () => void }>();

  const [sessions, setSessions] = useState<ApiWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await workoutsApi.history(PAGE));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, ApiWorkout[]>();
    for (const session of sessions) {
      const when = new Date(session.finished_at ?? session.started_at);
      const key = localDateKey(when);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(session);
      else byDate.set(key, [session]);
    }
    // Newest day first; within a day, newest session first.
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) =>
          (b.finished_at ?? b.started_at).localeCompare(a.finished_at ?? a.started_at),
        ),
      }));
  }, [sessions]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t("history")} onBack={() => navigation.goBack()} />

        {loading && sessions.length === 0 ? (
          <View style={styles.centred}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error && sessions.length === 0 ? (
          <EmptyState
            art="offline"
            title={t("couldNotLoadHistory")}
            body={error}
            actionLabel={t("tryAgain")}
            onAction={() => void load()}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            art="steps"
            title={t("nothingRecordedYet")}
            body={t("nothingRecordedBody")}
          />
        ) : (
          groups.map((group) => (
            <View key={group.date} style={styles.group}>
              <Text style={styles.groupTitle}>{groupTitle(group.date, t("today"), t("yesterday"))}</Text>
              {group.rows.map((session) => (
                <GlassCard key={session.id} style={styles.row}>
                  <Metric
                    icon="footsteps"
                    value={session.steps.toLocaleString()}
                    tint={colors.primary}
                  />
                  <Metric
                    icon="time-outline"
                    value={formatDuration(session.duration_seconds)}
                    tint={colors.amberInk}
                  />
                  <Metric
                    icon="flame"
                    value={String(session.calories_kcal)}
                    tint={colors.coralInk}
                  />
                  <Metric
                    icon="location"
                    value={session.distance_km.toFixed(2)}
                    tint={colors.emeraldInk}
                  />
                </GlassCard>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors: Palette) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120, gap: 18 },
  centred: { paddingVertical: spacing.xxxl, alignItems: "center" },

  group: { gap: 8 },
  groupTitle: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metric: { flexDirection: "row", alignItems: "center", gap: 5 },
  metricText: { fontSize: 13, fontWeight: "600", color: colors.charcoal },
}));
