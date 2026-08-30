/**
 * Where step access is granted, and where the truth about it is told.
 *
 * This replaces a full-screen wall that blocked the whole app behind
 * instructions describing a screen the user could never reach: it told them to
 * find STRIDE in Health Connect's app list, which was impossible because the
 * app never registered the permissions-rationale activity Health Connect
 * requires. Now it is reachable from Profile, it reports what is actually in
 * use, and it never claims Health Connect when the raw sensor is standing in.
 */

import { useCallback, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useHealth } from "../contexts/HealthContext";
import { useStride } from "../contexts/StrideContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { radii, spacing } from "../theme";
import { GlassCard } from "../components/GlassCard";
import { PressableScale } from "../components/PressableScale";
import { ScreenHeader } from "../components/ScreenHeader";

export function HealthSetupScreen() {
  const navigation = useNavigation<{ goBack: () => void }>();
  const { colors } = useTheme();
  const styles = useStyles();
  const health = useHealth();
  const { showToast } = useStride();
  const [busy, setBusy] = useState(false);

  const onGrant = useCallback(async () => {
    setBusy(true);
    const granted = await health.requestPermission();
    setBusy(false);
    if (granted) {
      showToast("Step access granted");
      return;
    }
    // Health Connect stops showing its dialog after two refusals, so a second
    // "denied" is not a decision the user just made — it is the system going
    // quiet. Sending them to settings is the only way forward.
    showToast("Grant step access in settings");
  }, [health, showToast]);

  const state = (() => {
    if (health.status === "ready") {
      return {
        tone: colors.emeraldInk,
        label: "Counting steps",
        detail: health.countsInBackground
          ? "Steps are counted even when STRIDE is closed."
          : "Steps are counted only while STRIDE is open.",
      };
    }
    if (health.status === "needs_permission") {
      return {
        tone: colors.coralInk,
        label: "Access needed",
        detail: "STRIDE cannot read your step count until you allow it.",
      };
    }
    if (health.status === "needs_update") {
      return {
        tone: colors.coralInk,
        label: "Health Connect is out of date",
        detail: "Update it from Google Play, then come back.",
      };
    }
    return {
      tone: colors.muted,
      label: "No step source",
      detail: "This device has no step counter STRIDE can read.",
    };
  })();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Step tracking" onBack={() => navigation.goBack()} />

        <View style={[styles.badge, { borderColor: `${state.tone}55`, backgroundColor: `${state.tone}18` }]}>
          <View style={[styles.dot, { backgroundColor: state.tone }]} />
          <Text style={[styles.badgeText, { color: state.tone }]}>{state.label}</Text>
        </View>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>
            {health.provider?.id === "health_connect"
              ? "Health Connect"
              : health.provider?.id === "core_motion"
                ? "Motion & Fitness"
                : "Step sensor"}
          </Text>
          <Text style={styles.body}>{state.detail}</Text>

          {/* The one thing the old screen never admitted. */}
          {health.degraded ? (
            <View style={styles.warn}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.coralInk} />
              <Text style={styles.warnText}>
                Health Connect is not available on this device, so STRIDE is using the
                phone&apos;s own step sensor. That only counts while the app is open —
                steps taken with STRIDE closed are not recorded.
              </Text>
            </View>
          ) : null}
        </GlassCard>

        {health.status !== "ready" ? (
          <PressableScale style={styles.primaryBtn} disabled={busy} onPress={() => void onGrant()}>
            <Text style={styles.primaryText}>
              {busy ? "Asking…" : "Allow step access"}
            </Text>
          </PressableScale>
        ) : null}

        {health.provider?.openSettings ? (
          <PressableScale style={styles.secondaryBtn} onPress={() => void health.openSettings()}>
            <Ionicons name="settings-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryText}>Open Health Connect settings</Text>
          </PressableScale>
        ) : null}

        <Text style={styles.footnote}>
          {Platform.OS === "android"
            ? "STRIDE only reads your step count. It never writes to Health Connect."
            : "STRIDE only reads your step count."}
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: "400" },
  card: { padding: 18, gap: 10 },
  cardTitle: { fontSize: 17, fontWeight: "400", color: colors.charcoal },
  body: { fontSize: 17, lineHeight: 21, color: colors.slate },
  warn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 4,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
  },
  warnText: { flex: 1, fontSize: 15, lineHeight: 19, color: colors.slate },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: colors.onPrimary, fontWeight: "400", fontSize: 17 },
  secondaryBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
  },
  secondaryText: { color: colors.primary, fontWeight: "400", fontSize: 17 },
  footnote: {
    marginTop: spacing.xl,
    fontSize: 15,
    lineHeight: 19,
    color: colors.muted,
    textAlign: "center",
  },
}));
