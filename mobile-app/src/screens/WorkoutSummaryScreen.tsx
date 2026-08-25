import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function WorkoutSummaryScreen() {
  const navigation = useNavigation<any>();
  const { lastWorkoutSummary, addWorkoutToHistory, showToast } = useStride();

  const distance = lastWorkoutSummary?.distanceKm ?? 3.84;
  const duration = lastWorkoutSummary?.durationFormatted ?? "42:15";
  const calories = lastWorkoutSummary?.caloriesKcal ?? 312;
  const pace = lastWorkoutSummary?.avgSpeed ?? 5.2;
  const tokensEarned = lastWorkoutSummary?.tokensEarned ?? 250;
  const steps = lastWorkoutSummary?.steps ?? 12432;
  const dateStr = lastWorkoutSummary?.date ?? "Oct 24, 2026 • 08:42 AM";

  const handleShare = () => {
    showToast("Workout shared to socials", "📣");
  };

  const handleSave = () => {
    addWorkoutToHistory({
      id: lastWorkoutSummary?.id || `w_sum_${Date.now()}`,
      distanceKm: distance,
      durationFormatted: duration,
      caloriesKcal: calories,
      avgSpeed: pace,
      tokensEarned,
      steps,
      date: dateStr,
    });
    navigation.navigate("PerformanceReport");
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Workout Summary" onBack={handleSave} light />

        <Text style={styles.hero}>Workout Completed!</Text>
        <Text style={styles.date}>{dateStr}</Text>

        <View style={styles.coinOuter}>
          <View style={styles.coinInner}>
            <Ionicons name="sparkles" size={28} color="#FDE68A" />
            <Text style={styles.coinValue}>+{tokensEarned}</Text>
            <Text style={styles.coinLabel}>Step-Tokens</Text>
            <Text style={styles.coinSub}>Reward Unlocked</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "Distance", value: String(distance), unit: "km" },
            { label: "Time", value: duration, unit: "mins" },
            { label: "Calories", value: String(calories), unit: "kcal" },
            { label: "Pace", value: String(pace), unit: "km/h" },
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
            <Text style={styles.savedTitle}>Ready to save</Text>
            <Text style={styles.savedBody}>Excellent pacing! Convert kinetic energy into persistent digital assets.</Text>
          </View>
        </GlassCard>

        <PressableScale style={styles.primaryBtn} onPress={handleSave}>
          <Text style={styles.primaryText}>SAVE & CONTINUE</Text>
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
