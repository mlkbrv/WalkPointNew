/**
 * The card shown after a session closes.
 *
 * It reads the finished workout back from the server rather than trusting what
 * the tracker had locally. Sessions do not pay coins — steps do — so this is a
 * record of what was done, not a receipt.
 */

import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { formatDuration } from "../contexts/StrideContext";
import { describeError } from "../api/client";
import { workoutsApi, type ApiWorkout, type ApiWorkoutRoute } from "../api/endpoints";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { RouteTrace } from "../components/RouteTrace";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function WorkoutSummaryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{
    goBack: () => void;
    navigate: (s: string, p?: object) => void;
  }>();

  const [workout, setWorkout] = useState<ApiWorkout | null>(null);
  const [route, setRoute] = useState<ApiWorkoutRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const last = await workoutsApi.last();
        if (cancelled) return;
        setWorkout(last);
        // The route lives only on the detail endpoint — the list/last shape
        // deliberately omits it so a lighter call stays lighter.
        if (last) {
          const detail = await workoutsApi.detail(last.id).catch(() => null);
          if (!cancelled) setRoute(detail?.route ?? null);
        }
      } catch (caught) {
        if (!cancelled) setError(describeError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const distance = workout ? workout.distance_km.toFixed(2) : "0.00";
  const duration = formatDuration(workout?.duration_seconds ?? 0);
  const calories = workout?.calories_kcal ?? 0;
  const hours = (workout?.duration_seconds ?? 0) / 3600;
  const pace = hours > 0 ? ((workout?.distance_km ?? 0) / hours).toFixed(1) : "0.0";
  const underReview = workout?.is_suspicious ?? false;
  const dateStr = workout?.finished_at
    ? new Date(workout.finished_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just walked ${distance} km on STRIDE — ${duration}, ${calories} kcal.`,
      });
    } catch {
      // A cancelled or failed share sheet needs no toast; the OS already showed one.
    }
  };

  // The server already saved it; this button just moves on. Report is a tab
  // now, so it is reached through the tab navigator rather than pushed.
  const handleSave = () => {
    navigation.navigate("Main", { screen: "ReportTab" });
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Workout Summary" onBack={() => navigation.goBack()} light />
          <GlassCard dark style={styles.savedBox}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.coralInk} />
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>
                {error ? "Could not load the workout" : "No finished workouts yet"}
              </Text>
              <Text style={styles.savedBody}>
                {error ?? "Track a session and it will show up here."}
              </Text>
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Workout Summary" onBack={handleSave} light />

        <Text style={styles.hero}>Workout Completed!</Text>
        <Text style={styles.date}>{dateStr}</Text>

        {/* Distance, not coins: the session is a record of what was done. Coins
            come from the day's steps, which this walk already contributed to. */}
        <View style={styles.coinOuter}>
          <View style={styles.coinInner}>
            <Ionicons
              name={underReview ? "search" : "walk-outline"}
              size={26}
              color={underReview ? colors.mutedDark : colors.primary}
            />
            <Text style={styles.coinValue}>{distance}</Text>
            <Text style={styles.coinLabel}>km</Text>
            <Text style={styles.coinSub}>
              {underReview ? "Under review" : "Recorded"}
            </Text>
          </View>
        </View>

        {underReview ? (
          <GlassCard dark style={styles.reviewBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.mutedDark} />
            <Text style={styles.reviewText}>
              This session moved faster than a person walks or runs, so it is
              flagged for a moderator. Your account is unaffected.
            </Text>
          </GlassCard>
        ) : null}

        <View style={styles.statsRow}>
          {[
            { label: "Distance", value: distance, unit: "km" },
            { label: "Time", value: duration, unit: "mins" },
            { label: "Calories", value: String(calories), unit: "kcal" },
            { label: "Pace", value: pace, unit: "km/h" },
          ].map((s) => (
            <GlassCard key={s.label} dark style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statUnit}>{s.unit}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Only shown when a route was actually recorded — no placeholder
            pretending every walk has a traced path. */}
        {route && route.coordinates.length >= 2 ? (
          <>
            <View style={styles.routeHeading}>
              <Ionicons name="compass-outline" size={14} color={colors.emerald} />
              <Text style={styles.routeText}>Route recorded</Text>
            </View>
            <RouteTrace points={route.coordinates} height={140} />
          </>
        ) : null}

        <GlassCard dark style={styles.savedBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.savedTitle}>Saved</Text>
            <Text style={styles.savedBody}>
              This session is recorded on your account and counted toward your weekly totals.
            </Text>
          </View>
        </GlassCard>

        <PressableScale style={styles.primaryBtn} onPress={handleSave}>
          <Text style={styles.primaryText}>CONTINUE</Text>
        </PressableScale>

        <PressableScale style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={16} color={colors.mutedDark} />
          <Text style={styles.shareText}>Share to Socials</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.dark },
  centred: { alignItems: "center", justifyContent: "center" },
  reviewBox: {
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  reviewText: { flex: 1, color: colors.mutedDark, fontSize: 12, lineHeight: 15 },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  hero: { color: colors.textLight, fontWeight: "700", fontSize: 28, textAlign: "center", marginTop: 8 },
  date: { color: colors.mutedDark, fontSize: 12, fontWeight: "600", letterSpacing: 1, textAlign: "center", marginTop: 8, textTransform: "uppercase" },
  coinOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 6,
    borderColor: "rgba(62,207,174,0.4)",
    alignSelf: "center",
    marginVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A241E",
  },
  coinInner: {
    width: "88%",
    height: "88%",
    borderRadius: 999,
    backgroundColor: "#071912",
    borderWidth: 1,
    borderColor: "rgba(62,207,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  coinValue: { color: "#FDE68A", fontWeight: "700", fontSize: 34, marginTop: 4 },
  coinLabel: { color: "#7FE0C4", fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  coinSub: { color: colors.mutedDark, fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, padding: 10, alignItems: "center" },
  statLabel: { color: colors.mutedDark, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  statValue: { color: colors.primary, fontWeight: "600", fontSize: 13, marginTop: 6 },
  statUnit: { color: colors.slate, fontSize: 11, fontWeight: "600", marginTop: 2, textTransform: "uppercase" },
  routeHeading: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, marginBottom: 8 },
  routeText: { color: "#CBD5E1", fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  savedBox: { marginTop: spacing.lg, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  savedTitle: { color: colors.textLight, fontWeight: "600", fontSize: 13 },
  savedBody: { color: colors.mutedDark, fontSize: 12, marginTop: 4, lineHeight: 15 },
  primaryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontWeight: "600", fontSize: 13, letterSpacing: 1 },
  shareBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareText: { color: colors.mutedDark, fontWeight: "600", fontSize: 13 },
}));
