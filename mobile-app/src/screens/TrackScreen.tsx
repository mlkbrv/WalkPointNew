/**
 * Activity.
 *
 * This screen used to invent everything it showed. Distance advanced by a fixed
 * 0.002 km every second whether the phone was moving or lying on a table —
 * exactly 7.2 km/h for everyone. Calories accumulated 0.15 per tick through a
 * `Math.floor`, so the fractional part was discarded every time and the number
 * never left zero. The route was a `Math.random()` walk in screen pixels, drawn
 * over three slanted rectangles that were the same "roads" for every user on
 * Earth. A pill read "GPS TRACKING ACTIVE" while nothing had ever asked for a
 * location.
 *
 * None of that is here. Steps come from the system and are counted whether the
 * app is open or not, so there is nothing to start: the day's total and the
 * week's history are simply shown. The one thing that genuinely needs asking
 * for is GPS, because it costs battery and it is location data — so route
 * recording is a switch, and while it is on Android shows a persistent
 * notification saying so.
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "../api/client";
import { workoutsApi, type ApiWeeklySummary, type ApiWorkout } from "../api/endpoints";
import { GlassCard } from "../components/GlassCard";
import { PressableScale } from "../components/PressableScale";
import { RouteTrace } from "../components/RouteTrace";
import { useHealth } from "../contexts/HealthContext";
import { useStride, formatDuration } from "../contexts/StrideContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { useRouteRecorder } from "../hooks/useRouteRecorder";
import { useStepHistory } from "../hooks/useStepHistory";
import { radii, spacing } from "../theme";
import { caloriesFromSteps, distanceFromSteps } from "../utils/metrics";

export function TrackScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const health = useHealth();
  const { showToast } = useStride();
  const week = useStepHistory();
  const recorder = useRouteRecorder();

  const [summary, setSummary] = useState<ApiWeeklySummary | null>(null);
  const [recent, setRecent] = useState<ApiWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [totals, history] = await Promise.all([
        workoutsApi.summary(),
        workoutsApi.history(5),
      ]);
      setSummary(totals);
      setRecent(history);
    } catch {
      // The screen's real content is today's steps, which come from the device.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleRecording = useCallback(async () => {
    if (recorder.recording) {
      setSaving(true);
      const route = await recorder.stop();
      if (!route) {
        setSaving(false);
        showToast(t("tooShortToSave"));
        return;
      }
      try {
        // The session exists only to carry the route; steps are already counted.
        const started = await workoutsApi.start("walk");
        await workoutsApi.finish(started.id, {
          distance_km: route.distanceKm,
          duration_seconds: route.t[route.t.length - 1] ?? 0,
          route: { v: 1, coordinates: route.coordinates, t: route.t, dist_km: route.distanceKm },
        });
        showToast(t("routeSaved", { km: route.distanceKm.toFixed(2) }));
        void load();
      } catch (caught) {
        showToast(describeError(caught));
      } finally {
        setSaving(false);
      }
      return;
    }

    const ok = await recorder.start();
    if (ok) showToast(t("recordingYourRoute"));
  }, [recorder, showToast, load]);

  const steps = health.stepsToday;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t("activityTitle")}</Text>

        {/* Today, from the system. Nothing here was started by a button. */}
        <GlassCard style={styles.today}>
          <Text style={styles.steps}>{steps.toLocaleString()}</Text>
          <Text style={styles.stepsLabel}>{t("stepsToday")}</Text>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{distanceFromSteps(steps).toFixed(2)}</Text>
              <Text style={styles.metricLabel}>{t("km")}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{caloriesFromSteps(steps)}</Text>
              <Text style={styles.metricLabel}>{t("kcal")}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {week.changePercent === null ? "—" : `${week.changePercent > 0 ? "+" : ""}${week.changePercent}%`}
              </Text>
              <Text style={styles.metricLabel}>{t("vsLastWeek")}</Text>
            </View>
          </View>

          {health.status !== "ready" ? (
            <Text style={styles.notice}>
              {t("cannotReadSteps")}
            </Text>
          ) : !health.countsInBackground ? (
            <Text style={styles.notice}>
              {t("onlyWhileOpen")}
            </Text>
          ) : null}
        </GlassCard>

        {/* The one thing worth asking permission for. */}
        <GlassCard style={styles.recordCard}>
          <View style={styles.recordRow}>
            <View style={styles.recordText}>
              <Text style={styles.recordTitle}>{t("recordRoute")}</Text>
              <Text style={styles.recordBody}>
                {recorder.recording
                  ? t("recordingNow")
                  : t("recordRouteBody")}
              </Text>
            </View>
            <Switch
              value={recorder.recording}
              disabled={saving}
              onValueChange={() => void toggleRecording()}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {recorder.error ? <Text style={styles.error}>{recorder.error}</Text> : null}

          {recorder.recording || recorder.points.length > 0 ? (
            <>
              <RouteTrace points={recorder.points} />
              <View style={styles.liveRow}>
                <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.liveText}>
                  {recorder.distanceKm.toFixed(2)} km · {recorder.points.length} points
                </Text>
              </View>
            </>
          ) : null}
        </GlassCard>

        <Text style={styles.section}>{t("thisWeek")}</Text>
        <GlassCard style={styles.weekCard}>
          {loading && !summary ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{week.thisWeek.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>{t("metricSteps")}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{summary?.sessions ?? 0}</Text>
                <Text style={styles.metricLabel}>{t("routes")}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {(summary?.distance_km ?? 0).toFixed(1)}
                </Text>
                <Text style={styles.metricLabel}>{t("kmRecorded")}</Text>
              </View>
            </View>
          )}
        </GlassCard>

        {recent.length > 0 ? (
          <>
            <Text style={styles.section}>{t("recentRoutes")}</Text>
            {recent.map((workout) => (
              <GlassCard key={workout.id} style={styles.historyRow}>
                <View style={styles.historyText}>
                  <Text style={styles.historyDate}>
                    {new Date(workout.finished_at ?? workout.started_at).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" },
                    )}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {workout.distance_km.toFixed(2)} km · {formatDuration(workout.duration_seconds)}
                  </Text>
                </View>
                {workout.is_suspicious ? (
                  <Text style={styles.flagged}>{t("underReview")}</Text>
                ) : null}
              </GlassCard>
            ))}
          </>
        ) : null}

        <PressableScale style={styles.reportsBtn} onPress={() => void load()}>
          <Text style={styles.reportsText}>{t("refresh")}</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 },
  title: { fontSize: 34, fontWeight: "700", color: colors.charcoal, marginBottom: 4 },

  today: { padding: 20, alignItems: "center", gap: 4 },
  steps: { fontSize: 34, fontWeight: "700", color: colors.charcoal },
  stepsLabel: { fontSize: 15, color: colors.muted },

  metrics: { flexDirection: "row", marginTop: 16, alignSelf: "stretch" },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 17, fontWeight: "600", color: colors.charcoal },
  metricLabel: { fontSize: 13, color: colors.muted },

  notice: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: "center",
  },

  recordCard: { padding: 18, gap: 14 },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  recordText: { flex: 1, gap: 4 },
  recordTitle: { fontSize: 17, fontWeight: "600", color: colors.charcoal },
  recordBody: { fontSize: 13, lineHeight: 18, color: colors.muted },
  error: { fontSize: 13, color: colors.coralInk },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { fontSize: 13, color: colors.slate },

  section: { fontSize: 15, fontWeight: "600", color: colors.muted, marginTop: 8 },
  weekCard: { padding: 18, minHeight: 84, justifyContent: "center" },

  historyRow: { padding: 16, flexDirection: "row", alignItems: "center" },
  historyText: { flex: 1, gap: 2 },
  historyDate: { fontSize: 15, fontWeight: "600", color: colors.charcoal },
  historyMeta: { fontSize: 13, color: colors.muted },
  flagged: { fontSize: 13, color: colors.muted, fontStyle: "italic" },

  reportsBtn: {
    marginTop: 4,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  reportsText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  spacing: { height: spacing.md },
}));
