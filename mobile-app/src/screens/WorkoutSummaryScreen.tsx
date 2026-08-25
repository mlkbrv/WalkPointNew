/**
 * The card shown after a session closes.
 *
 * It reads the finished workout back from the server rather than trusting what
 * the tracker had locally — the coin figure here is `bonus_paid`, the amount the
 * ledger actually recorded. A session held for fraud review shows zero and says
 * so, which is the one case a locally-computed number would get wrong.
 */

import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride, formatDuration } from "../contexts/StrideContext";
import { describeError } from "../api/client";
import { workoutsApi, type ApiWorkout } from "../api/endpoints";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function WorkoutSummaryScreen() {
  const navigation = useNavigation<any>();
  const { showToast } = useStride();

  const [workout, setWorkout] = useState<ApiWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const last = await workoutsApi.last();
        if (!cancelled) setWorkout(last);
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
  const coinsEarned = workout?.bonus_paid ?? 0;
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

  const handleShare = () => {
    showToast("Workout shared to socials", "\u{1F4E3}");
  };

  // The server already saved it; this button just moves on.
  const handleSave = () => {
    navigation.navigate("PerformanceReport");
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
            <Ionicons name="cloud-offline-outline" size={20} color={colors.coral} />
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

        <View style={styles.coinOuter}>
          <View style={styles.coinInner}>
            <Ionicons
              name={underReview ? "search" : "sparkles"}
              size={28}
              color={underReview ? colors.muted : "#FDE68A"}
            />
            <Text style={styles.coinValue}>+{coinsEarned}</Text>
            <Text style={styles.coinLabel}>Coins</Text>
            <Text style={styles.coinSub}>
              {underReview ? "Held for review" : "Reward Unlocked"}
            </Text>
          </View>
        </View>

        {underReview ? (
          <GlassCard dark style={styles.reviewBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
            <Text style={styles.reviewText}>
              This session moved faster than a person walks or runs, so the bonus is
              held while a moderator looks at it. Your account is unaffected.
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

        <GlassCard dark style={styles.routeCard}>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Ionicons name="compass-outline" size={14} color={colors.emerald} />
            <Text style={styles.routeText}>Morning Run Route</Text>
          </View>
        </GlassCard>

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
          <Ionicons name="share-social-outline" size={16} color={colors.muted} />
          <Text style={styles.shareText}>Share to Socials</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  centred: { alignItems: "center", justifyContent: "center" },
  reviewBox: {
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  reviewText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  hero: { color: colors.textLight, fontWeight: "800", fontSize: 24, textAlign: "center", marginTop: 8 },
  date: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textAlign: "center", marginTop: 8, textTransform: "uppercase" },
  coinOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 6,
    borderColor: "rgba(129,64,243,0.55)",
    alignSelf: "center",
    marginVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#170A2D",
  },
  coinInner: {
    width: "88%",
    height: "88%",
    borderRadius: 999,
    backgroundColor: "#100325",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  coinValue: { color: "#FDE68A", fontWeight: "900", fontSize: 28, marginTop: 4 },
  coinLabel: { color: "#A78BFA", fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  coinSub: { color: colors.muted, fontSize: 7, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, padding: 10, alignItems: "center" },
  statLabel: { color: colors.muted, fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: colors.primary, fontWeight: "900", fontSize: 12, marginTop: 6 },
  statUnit: { color: colors.slate, fontSize: 8, fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
  routeCard: { height: 112, marginTop: spacing.lg, padding: 14, justifyContent: "flex-end", overflow: "hidden" },
  routeLine: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 40,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    transform: [{ rotate: "-8deg" }],
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeText: { color: "#CBD5E1", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  savedBox: { marginTop: spacing.lg, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  savedTitle: { color: colors.textLight, fontWeight: "900", fontSize: 12 },
  savedBody: { color: colors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  primaryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
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
  shareText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
});
