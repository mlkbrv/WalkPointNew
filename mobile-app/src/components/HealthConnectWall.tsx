import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHealth } from "../contexts/HealthContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "./PressableScale";

const HC_PLAY =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";
const HC_SETTINGS = "android-app://com.google.android.apps.healthdata";

const STEPS = [
  "Install Health Connect from Google Play if it is missing",
  "Open Health Connect → App permissions → STRIDE",
  "Allow Steps (read) for STRIDE",
  "Return here and tap Enable Health Connect",
];

export function HealthConnectWall() {
  const insets = useSafeAreaInsets();
  const health = useHealth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (Platform.OS !== "android" || !health.needsHealthConnectWall) return null;

  const openStore = async () => {
    try {
      await Linking.openURL(HC_PLAY);
    } catch {
      setError("Could not open Google Play.");
    }
  };

  const openSettings = async () => {
    try {
      const can = await Linking.canOpenURL(HC_SETTINGS);
      if (can) await Linking.openURL(HC_SETTINGS);
      else await Linking.openURL(HC_PLAY);
    } catch {
      setError("Open Health Connect manually and allow Steps for STRIDE.");
    }
  };

  const onEnable = async () => {
    setBusy(true);
    setError("");
    const ok = await health.connectHealthConnect();
    setBusy(false);
    if (!ok) {
      setError(
        health.permissionMessage ||
          "Health Connect is required. Install it, allow Steps for STRIDE, then try again."
      );
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="fitness" size={40} color={colors.primary} />
      </View>
      <Text style={styles.title}>Health Connect required</Text>
      <Text style={styles.body}>
        On Android, STRIDE only works after Health Connect is installed and Steps access is allowed.
        You cannot continue until this is enabled.
      </Text>

      {STEPS.map((line, i) => (
        <View key={line} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{line}</Text>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PressableScale style={styles.primary} onPress={onEnable} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>ENABLE HEALTH CONNECT</Text>
        )}
      </PressableScale>

      <PressableScale style={styles.secondary} onPress={openSettings} disabled={busy}>
        <Ionicons name="settings-outline" size={16} color={colors.primary} />
        <Text style={styles.secondaryText}>Open Health Connect</Text>
      </PressableScale>

      <PressableScale style={styles.linkBtn} onPress={openStore} disabled={busy}>
        <Text style={styles.linkText}>Install from Google Play</Text>
      </PressableScale>

      {typeof __DEV__ !== "undefined" && __DEV__ ? (
        <PressableScale
          style={styles.devBtn}
          onPress={async () => {
            await health.setMockMode(true);
          }}
        >
          <Text style={styles.devText}>Dev only: Mock Mode</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.xl,
    zIndex: 100,
    elevation: 100,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(129,64,243,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.charcoal,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.slate,
    marginBottom: spacing.xl,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: spacing.md,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(129,64,243,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  stepText: { flex: 1, color: colors.charcoal, fontSize: 13, lineHeight: 18 },
  error: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  primary: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  secondary: {
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
  linkBtn: { marginTop: spacing.md, alignItems: "center", paddingVertical: 8 },
  linkText: { color: colors.slate, fontWeight: "700", fontSize: 12, textDecorationLine: "underline" },
  devBtn: { marginTop: spacing.lg, alignItems: "center" },
  devText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});
