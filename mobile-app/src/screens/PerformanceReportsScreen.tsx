import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

type Tab = "Day" | "Week" | "Month";

export function PerformanceReportsScreen() {
  const navigation = useNavigation<any>();
  const { userStats, workoutHistory, lastWorkoutSummary, showToast } = useStride();
  const [activeTab, setActiveTab] = useState<Tab>("Week");

  const chartData = useMemo(() => {
    if (activeTab === "Day") {
      return [
        { label: "6a", steps: Math.floor(userStats.stepsToday * 0.08) },
        { label: "9a", steps: Math.floor(userStats.stepsToday * 0.18) },
        { label: "12p", steps: Math.floor(userStats.stepsToday * 0.22) },
        { label: "3p", steps: Math.floor(userStats.stepsToday * 0.2) },
        { label: "6p", steps: Math.floor(userStats.stepsToday * 0.2) },
        { label: "9p", steps: Math.floor(userStats.stepsToday * 0.12) },
      ];
    }
    if (activeTab === "Month") {
      return [
        { label: "W1", steps: 62000 },
        { label: "W2", steps: 71000 },
        { label: "W3", steps: 58000 },
        { label: "W4", steps: userStats.weeklySteps.reduce((a, b) => a + b.steps, 0) },
      ];
    }
    return userStats.weeklySteps.map((w) => ({
      label: w.day,
      steps: w.steps,
      active: !!w.isToday,
    }));
  }, [activeTab, userStats]);

  const maxSteps = Math.max(...chartData.map((d) => d.steps), 1);
  const displaySteps = lastWorkoutSummary?.steps ?? userStats.stepsToday;
  const displayDistance = lastWorkoutSummary?.distanceKm ?? (userStats.stepsToday * 0.00075).toFixed(1);
  const displayCalories = lastWorkoutSummary?.caloriesKcal ?? Math.floor(userStats.stepsToday * 0.04);

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
                  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  "📅"
                )
              }
            >
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </PressableScale>
          }
        />

        <View style={styles.tabs}>
          {(["Day", "Week", "Month"] as Tab[]).map((tab) => (
            <PressableScale
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </PressableScale>
          ))}
        </View>

        <GlassCard style={styles.chartCard}>
          <View style={styles.chartRow}>
            {chartData.map((d, i) => (
              <View key={`${d.label}-${i}`} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(8, (d.steps / maxSteps) * 100)}%`,
                        backgroundColor: (d as any).active ? colors.primary : "rgba(129,64,243,0.35)",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{d.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <View style={styles.metrics}>
          <GlassCard style={styles.metric}>
            <Ionicons name="footsteps-outline" size={16} color={colors.primary} />
            <Text style={styles.metricValue}>{Number(displaySteps).toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Steps</Text>
          </GlassCard>
          <GlassCard style={styles.metric}>
            <Ionicons name="navigate-outline" size={16} color={colors.coral} />
            <Text style={styles.metricValue}>{displayDistance}</Text>
            <Text style={styles.metricLabel}>km</Text>
          </GlassCard>
          <GlassCard style={styles.metric}>
            <Ionicons name="flame-outline" size={16} color={colors.emerald} />
            <Text style={styles.metricValue}>{displayCalories}</Text>
            <Text style={styles.metricLabel}>kcal</Text>
          </GlassCard>
        </View>

        <Text style={styles.section}>Workout History</Text>
        {workoutHistory.length === 0 ? (
          <Text style={styles.empty}>No workouts saved yet.</Text>
        ) : (
          workoutHistory.map((w) => (
            <GlassCard key={w.id} style={styles.histItem}>
              <View style={styles.histTop}>
                <Text style={styles.histDate}>{w.date}</Text>
                <Text style={styles.histTokens}>+{w.tokensEarned} ST</Text>
              </View>
              <View style={styles.histRow}>
                <Text style={styles.histStat}>{w.steps?.toLocaleString?.() || w.steps} steps</Text>
                <Text style={styles.histStat}>{w.distanceKm} km</Text>
                <Text style={styles.histStat}>{w.duration || w.durationFormatted}</Text>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  calBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.white,
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
  chartCard: { padding: 16, height: 180 },
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
  histRow: { flexDirection: "row", gap: 12 },
  histStat: { color: colors.slate, fontSize: 11, fontWeight: "600" },
});
