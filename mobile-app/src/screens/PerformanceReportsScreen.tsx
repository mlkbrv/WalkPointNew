/**
 * Report.
 *
 * Laid out after the reference: an all-time hero, a statistics card with a
 * selectable chart and metric filters, a month calendar, and a short tail of
 * recent sessions that links out to the full history.
 *
 * Every number still comes from the server — the chart and the calendar from
 * `daily_steps`, the totals and the sessions from finished workouts. The metric
 * chips switch what the same days are *measured* in rather than fetching
 * anything new: distance and calories are derived from the step count by the
 * same conversions the rest of the app uses, so the four views cannot disagree
 * with each other or with Home.
 */

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "../api/client";
import {
  stepsApi,
  workoutsApi,
  type ApiDailySteps,
  type ApiWeeklySummary,
  type ApiWorkout,
} from "../api/endpoints";
import { formatDuration } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { BarChart, type Bar } from "../components/BarChart";
import { DropdownChip } from "../components/DropdownChip";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { MonthCalendar } from "../components/MonthCalendar";
import { PressableScale } from "../components/PressableScale";
import { SegmentedChips } from "../components/SegmentedChips";
import { StatTileRow, type Stat } from "../components/StatTileRow";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { caloriesFromSteps, distanceFromSteps, minutesFromSteps } from "../utils/metrics";

const PERIODS = ["This Week", "This Month"] as const;
type Period = (typeof PERIODS)[number];

const METRICS = ["Steps", "Time", "Calorie", "Distance"] as const;
type Metric = (typeof METRICS)[number];

/** Enough to cover the six rows a month grid can show. */
const HISTORY_DAYS = 42;

/** Weekday initial for a `YYYY-MM-DD` date, parsed as local time. */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(year, month - 1, day).getDay()];
}

function measure(steps: number, metric: Metric): number {
  if (metric === "Time") return minutesFromSteps(steps);
  if (metric === "Calorie") return caloriesFromSteps(steps);
  if (metric === "Distance") return distanceFromSteps(steps);
  return steps;
}

function formatMetric(value: number, metric: Metric): string {
  if (metric === "Time") return `${value} min`;
  if (metric === "Calorie") return `${value} kcal`;
  if (metric === "Distance") return `${value.toFixed(2)} km`;
  return value.toLocaleString();
}

export function PerformanceReportsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ navigate: (s: string) => void }>();

  const [period, setPeriod] = useState<Period>("This Week");
  const [metric, setMetric] = useState<Metric>("Steps");
  const [month, setMonth] = useState(() => new Date());
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const [days, setDays] = useState<ApiDailySteps[]>([]);
  const [sessions, setSessions] = useState<ApiWorkout[]>([]);
  const [summary, setSummary] = useState<ApiWeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [history, workouts, totals] = await Promise.all([
        stepsApi.history(HISTORY_DAYS),
        workoutsApi.history(5),
        workoutsApi.summary(),
      ]);
      setDays(history.days);
      setSessions(workouts);
      setSummary(totals);
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

  const ordered = useMemo(
    () => [...days].sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );

  const chartData = useMemo<Bar[]>(() => {
    if (period === "This Week") {
      return ordered.slice(-7).map((day) => ({
        key: day.date,
        label: dayLabel(day.date),
        value: measure(day.steps, metric),
      }));
    }

    // A month of daily bars is unreadable at this width, so fold it into weeks.
    const recent = ordered.slice(-28);
    const weeks: Bar[] = [];
    for (let i = 0; i < recent.length; i += 7) {
      const chunk = recent.slice(i, i + 7);
      const steps = chunk.reduce((sum, d) => sum + d.steps, 0);
      weeks.push({
        key: chunk[0]?.date ?? `w${i}`,
        label: `W${weeks.length + 1}`,
        value: measure(steps, metric),
      });
    }
    return weeks;
  }, [ordered, period, metric]);

  const activeDates = useMemo(
    () => new Set(ordered.filter((d) => d.steps > 0).map((d) => d.date)),
    [ordered],
  );

  const totalSteps = ordered.reduce((sum, day) => sum + day.steps, 0);

  const heroStats: Stat[] = [
    {
      key: "time",
      icon: "time-outline",
      value: formatDuration(summary?.duration_seconds ?? 0),
      unit: "time",
      tone: "time",
    },
    {
      key: "calories",
      icon: "flame",
      value: String(caloriesFromSteps(totalSteps)),
      unit: "kcal",
      tone: "calories",
    },
    {
      key: "distance",
      icon: "location",
      value: (summary?.distance_km ?? 0).toFixed(2),
      unit: "km",
      tone: "distance",
    },
  ];

  if (loading && ordered.length === 0) {
    return (
      <View style={[styles.root, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Report</Text>

        {error && ordered.length === 0 ? (
          <EmptyState
            art="offline"
            title="Could not load your report"
            body={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : (
          <>
            <GlassCard style={styles.hero}>
              <Ionicons name="footsteps" size={22} color={colors.primary} />
              <Text style={styles.heroValue}>{totalSteps.toLocaleString()}</Text>
              <Text style={styles.heroLabel}>Total steps recorded</Text>
            </GlassCard>

            <StatTileRow stats={heroStats} />

            <GlassCard style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Statistics</Text>
                <DropdownChip value={period} options={PERIODS} onChange={setPeriod} />
              </View>

              {chartData.length === 0 ? (
                <Text style={styles.empty}>No steps recorded in this period yet.</Text>
              ) : (
                <BarChart
                  data={chartData}
                  selectedKey={selectedBar}
                  onSelect={(key) => setSelectedBar((prev) => (prev === key ? null : key))}
                  formatTooltip={(bar) => formatMetric(bar.value, metric)}
                  formatY={
                    metric === "Distance"
                      ? (n) => n.toFixed(n >= 10 ? 0 : 1)
                      : undefined
                  }
                />
              )}

              <SegmentedChips options={METRICS} value={metric} onChange={setMetric} />
            </GlassCard>

            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Your Progress</Text>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                activeDates={activeDates}
              />
            </GlassCard>

            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Recent activity</Text>
              <PressableScale
                style={styles.link}
                onPress={() => navigation.navigate("History")}
              >
                <Text style={styles.linkText}>All history</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </PressableScale>
            </View>

            {sessions.length === 0 ? (
              <GlassCard style={styles.card}>
                <Text style={styles.empty}>No recorded routes yet.</Text>
              </GlassCard>
            ) : (
              sessions.map((session) => (
                <GlassCard key={session.id} style={styles.session}>
                  <View style={styles.sessionText}>
                    <Text style={styles.sessionDate}>
                      {new Date(session.finished_at ?? session.started_at).toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" },
                      )}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {session.distance_km.toFixed(2)} km ·{" "}
                      {formatDuration(session.duration_seconds)}
                    </Text>
                  </View>
                  {session.is_suspicious ? (
                    <Text style={styles.flagged}>under review</Text>
                  ) : null}
                </GlassCard>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  screenTitle: { fontSize: 28, fontWeight: "700", color: colors.charcoal, marginTop: 4 },

  hero: { paddingVertical: 22, alignItems: "center", gap: 4 },
  heroValue: { fontSize: 34, fontWeight: "700", color: colors.charcoal },
  heroLabel: { fontSize: 13, color: colors.muted },

  // overflow visible so the chart tooltip and the period menu are not clipped.
  card: { padding: 18, gap: 16, overflow: "visible" },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.charcoal },
  empty: { fontSize: 13, color: colors.muted, paddingVertical: spacing.lg, textAlign: "center" },

  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  session: { padding: 16, flexDirection: "row", alignItems: "center", borderRadius: radii.lg },
  sessionText: { flex: 1, gap: 2 },
  sessionDate: { fontSize: 14, fontWeight: "600", color: colors.charcoal },
  sessionMeta: { fontSize: 12, color: colors.muted },
  flagged: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
}));
