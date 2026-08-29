/**
 * Performance reports.
 *
 * Every number here comes from the server: the chart from `daily_steps`, the
 * totals and the session list from finished workouts. The old hourly "Day" view
 * was dropped rather than kept — the API records steps per day, so an hourly
 * breakdown could only have been invented from the daily total.
 */

import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "../api/client";
import {
  stepsApi,
  workoutsApi,
  type ApiDailySteps,
  type ApiWeeklySummary,
  type ApiWorkout,
} from "../api/endpoints";
import { useStride, formatDuration } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

type Tab = "Week" | "Month";

const DAYS: Record<Tab, number> = { Week: 7, Month: 28 };

/** Weekday initial for a `YYYY-MM-DD` date, parsed as local time. */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(year, month - 1, day).getDay()];
}

export function PerformanceReportsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const { showToast } = useStride();

  const [activeTab, setActiveTab] = useState<Tab>("Week");
  const [days, setDays] = useState<ApiDailySteps[]>([]);
  const [sessions, setSessions] = useState<ApiWorkout[]>([]);
  const [summary, setSummary] = useState<ApiWeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tab: Tab) => {
    setError(null);
    try {
      const [history, workouts, totals] = await Promise.all([
        stepsApi.history(DAYS[tab]),
        workoutsApi.history(20),
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
      void load(activeTab);
    }, [load, activeTab]),
  );

  const chartData = useMemo(() => {
    // Oldest first, so the chart reads left to right like a calendar.
    const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));

    if (activeTab === "Week") {
      return ordered.map((day) => ({
        label: dayLabel(day.date),
        steps: day.steps,
        active: day.date === new Date().toISOString().slice(0, 10),
      }));
    }

    // A month of daily bars is unreadable, so fold it into four weekly totals.
    const weeks: { label: string; steps: number; active: boolean }[] = [];
    for (let index = 0; index < ordered.length; index += 7) {
      const chunk = ordered.slice(index, index + 7);
      weeks.push({
        label: `W${weeks.length + 1}`,
        steps: chunk.reduce((total, day) => total + day.steps, 0),
        active: index + 7 >= ordered.length,
      });
    }
    return weeks;
  }, [days, activeTab]);

  const maxSteps = Math.max(...chartData.map((d) => d.steps), 1);
  const totalSteps = days.reduce((total, day) => total + day.steps, 0);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Performance Reports"
          onBack={() => navigation.goBack()}
          right={
            <PressableScale
              style={styles.calBtn}
              onPress={() =>
                showToast(
                  new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                  "\u{1F4C5}",
                )
              }
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </PressableScale>
          }
        />

        <View style={styles.tabs}>
          {(["Week", "Month"] as Tab[]).map((tab) => (
            <PressableScale
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => {
                setActiveTab(tab);
                setLoading(true);
              }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </PressableScale>
          ))}
        </View>

        {loading && days.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error && days.length === 0 ? (
          <EmptyState
            art="offline"
            title="Could not load your reports"
            body={error ?? undefined}
            actionLabel="Try again"
            onAction={() => void load(activeTab)}
          />
        ) : (
          <>
            <GlassCard style={styles.chartCard}>
              {chartData.length === 0 ? (
                <View style={styles.chartEmpty}>
                  <Text style={styles.empty}>No steps recorded in this period yet.</Text>
                </View>
              ) : (
                <View style={styles.chartRow}>
                  {chartData.map((d, i) => (
                    <View key={`${d.label}-${i}`} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${Math.max(8, (d.steps / maxSteps) * 100)}%`,
                              backgroundColor: d.active
                                ? colors.primary
                                : "rgba(129,64,243,0.35)",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{d.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </GlassCard>

            <View style={styles.metrics}>
              <GlassCard style={styles.metric}>
                <Ionicons name="footsteps-outline" size={16} color={colors.primary} />
                <Text style={styles.metricValue}>{totalSteps.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Steps</Text>
              </GlassCard>
              <GlassCard style={styles.metric}>
                <Ionicons name="navigate-outline" size={16} color={colors.coralInk} />
                <Text style={styles.metricValue}>{summary?.distance_km.toFixed(1) ?? "0.0"}</Text>
                <Text style={styles.metricLabel}>km</Text>
              </GlassCard>
              <GlassCard style={styles.metric}>
                <Ionicons name="flame-outline" size={16} color={colors.emeraldInk} />
                <Text style={styles.metricValue}>{summary?.calories_kcal ?? 0}</Text>
                <Text style={styles.metricLabel}>kcal</Text>
              </GlassCard>
            </View>

            <Text style={styles.section}>Workout History</Text>
            {sessions.length === 0 ? (
              <EmptyState
                art="steps"
                title="No workouts yet"
                body="Start a session on the Track tab and it will appear here."
              />
            ) : (
              sessions.map((w) => (
                <GlassCard key={w.id} style={styles.histItem}>
                  <View style={styles.histTop}>
                    <Text style={styles.histDate}>
                      {new Date(w.finished_at ?? w.started_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                    <Text style={w.is_suspicious ? styles.histHeld : styles.histTokens}>
                      {w.is_suspicious ? "under review" : `+${w.bonus_paid} coins`}
                    </Text>
                  </View>
                  <View style={styles.histRow}>
                    <Text style={styles.histStat}>{w.steps.toLocaleString()} steps</Text>
                    <Text style={styles.histStat}>{w.distance_km.toFixed(2)} km</Text>
                    <Text style={styles.histStat}>{formatDuration(w.duration_seconds)}</Text>
                  </View>
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
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  calBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radii.full, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.slate, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: colors.white },
  loadingBox: { paddingVertical: 48, alignItems: "center" },
  errorCard: { padding: 24, alignItems: "center", gap: 8 },
  errorTitle: { fontSize: 15, fontWeight: "700", color: colors.charcoal },
  errorBody: { fontSize: 12, color: colors.slate, textAlign: "center" },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  chartCard: { padding: 16, height: 180 },
  chartEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  chartRow: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barTrack: { flex: 1, width: "70%", justifyContent: "flex-end", marginBottom: 6 },
  barFill: { width: "100%", borderRadius: 6, minHeight: 8 },
  barLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  metric: { flex: 1, padding: 14, alignItems: "center", gap: 4 },
  metricValue: { color: colors.charcoal, fontWeight: "900", fontSize: 14 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  section: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  empty: { color: colors.slate, fontSize: 12 },
  histItem: { padding: 14, marginBottom: spacing.md },
  histTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  histDate: { color: colors.charcoal, fontWeight: "700", fontSize: 12 },
  histTokens: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  histHeld: { color: colors.muted, fontWeight: "700", fontSize: 11, fontStyle: "italic" },
  histRow: { flexDirection: "row", gap: 12 },
  histStat: { color: colors.slate, fontSize: 11, fontWeight: "600" },
}));
