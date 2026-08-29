import React, { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useHealth } from "../contexts/HealthContext";
import { useStride } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function HealthSetupScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const health = useHealth();
  const { showToast } = useStride();
  const [busy, setBusy] = useState(false);

  const statusColor =
    health.status === "available"
      ? colors.emeraldInk
      : health.status === "denied"
        ? colors.coralInk
        : colors.muted;

  const onRequest = async () => {
    setBusy(true);
    const ok = await health.requestPermissions();
    setBusy(false);
    showToast(ok ? "Permissions granted" : "Permission denied", ok ? "✅" : "⚠️");
  };

  const onStart = async () => {
    setBusy(true);
    await health.startTracking();
    setBusy(false);
    showToast("Tracking started", "🏃");
  };

  const iosSteps = [
    "Open Settings → Privacy & Security → Motion & Fitness",
    "Enable Fitness Tracking and allow STRIDE",
    "Return here and tap Request Permissions",
    "Tap Start Tracking to sync live steps",
  ];

  const androidSteps = [
    "Install Health Connect from Google Play if missing",
    "Open Health Connect → App permissions → STRIDE → Allow Steps",
    "Return here and tap Request Permissions",
    "STRIDE stays blocked on Android until Health Connect is enabled",
  ];

  const steps = Platform.OS === "ios" ? iosSteps : androidSteps;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Health Setup" onBack={() => navigation.goBack()} />

        <View style={[styles.badge, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {health.status.toUpperCase()}
            {health.isTracking ? " • TRACKING" : ""}
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>
            {Platform.OS === "ios" ? "iOS Motion & Fitness" : "Android Health Connect"}
          </Text>
          <Text style={styles.cardBody}>{health.permissionMessage || "Follow the steps below to connect your pedometer."}</Text>
          <Text style={styles.stepsToday}>{health.stepsToday.toLocaleString()} steps today</Text>

          {steps.map((s, i) => (
            <View key={s} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </GlassCard>

        <PressableScale style={styles.primaryBtn} onPress={onRequest} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>REQUEST PERMISSIONS</Text>}
        </PressableScale>

        <PressableScale style={styles.secondaryBtn} onPress={onStart} disabled={busy}>
          <Ionicons name="play" size={16} color={colors.primary} />
          <Text style={styles.secondaryText}>Start Tracking</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  card: { padding: 18 },
  cardTitle: { color: colors.charcoal, fontWeight: "900", fontSize: 16 },
  cardBody: { color: colors.slate, fontSize: 12, lineHeight: 18, marginTop: 8 },
  stepsToday: { color: colors.primary, fontWeight: "800", fontSize: 13, marginTop: 12, marginBottom: 8 },
  stepRow: { flexDirection: "row", gap: 12, marginTop: 12, alignItems: "flex-start" },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(129,64,243,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  stepText: { flex: 1, color: colors.charcoal, fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  secondaryBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.3)",
    backgroundColor: "rgba(129,64,243,0.08)",
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
}));
