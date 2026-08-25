import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

function buildCode(base: string, tick: number) {
  const suffix = Math.abs(Math.sin(tick) * 1e6)
    .toString(36)
    .slice(0, 4)
    .toUpperCase();
  return `${base}-${suffix}`;
}

function FakeQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const arr: boolean[] = [];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    for (let i = 0; i < 100; i++) {
      h = (h * 1664525 + 1013904223) >>> 0;
      arr.push(h % 3 !== 0);
    }
    return arr;
  }, [seed]);

  return (
    <View style={styles.qrGrid}>
      {cells.map((on, i) => (
        <View key={i} style={[styles.qrCell, on ? styles.qrOn : styles.qrOff]} />
      ))}
    </View>
  );
}

export function SecureVerificationScreen() {
  const navigation = useNavigation<any>();
  const { selectedCoupon, showToast } = useStride();
  const baseCode = selectedCoupon?.redemptionCode || "STRD-X9F3-88LK";
  const [tick, setTick] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const rollingCode = buildCode(baseCode, tick);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTick((t) => t + 1);
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const copyCode = async () => {
    await Clipboard.setStringAsync(rollingCode);
    showToast("Code copied", "📋");
  };

  const onDone = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Main");
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Secure Access" onBack={onDone} />

        <GlassCard style={styles.card}>
          <View style={styles.securePill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.coral} />
            <Text style={styles.secureText}>Secure Redemption</Text>
          </View>

          <Text style={styles.title}>Verify Reward</Text>
          <Text style={styles.sub}>
            {selectedCoupon?.brandName || "Partner"} • Store Partner Access
          </Text>

          <View style={styles.qrBox}>
            <FakeQr seed={rollingCode} />
          </View>

          <View style={styles.timerPill}>
            <View style={styles.dot} />
            <Text style={styles.timerText}>00:{String(secondsLeft).padStart(2, "0")}</Text>
          </View>

          <Text style={styles.code}>{rollingCode}</Text>
          <Text style={styles.hint}>Present this code at the store register to validate your ticket.</Text>

          <PressableScale style={styles.copyBtn} onPress={copyCode}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text style={styles.copyText}>Copy Code</Text>
          </PressableScale>
        </GlassCard>

        <PressableScale style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>DONE</Text>
        </PressableScale>

        <View style={styles.footer}>
          <Text style={styles.footerItem}>Encrypted Transfer</Text>
          <Text style={styles.footerItem}>Dynamic Rolling Code</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  card: { padding: 24, alignItems: "center" },
  securePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,107,82,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,107,82,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  secureText: { color: colors.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: colors.charcoal, fontWeight: "900", fontSize: 18, marginTop: 16 },
  sub: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 },
  qrBox: {
    width: 208,
    height: 208,
    backgroundColor: colors.dark,
    borderRadius: radii.xl,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  qrGrid: {
    width: 160,
    height: 160,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  qrCell: { width: "10%", height: "10%" },
  qrOn: { backgroundColor: colors.primary },
  qrOff: { backgroundColor: "transparent" },
  timerPill: {
    marginTop: 18,
    backgroundColor: colors.dark,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  timerText: { color: colors.white, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  code: { marginTop: 12, color: colors.slate, fontWeight: "700", fontSize: 11, letterSpacing: 2 },
  hint: { marginTop: 16, color: colors.slate, fontSize: 10, textAlign: "center", lineHeight: 15, maxWidth: 240 },
  copyBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: "rgba(129,64,243,0.1)",
  },
  copyText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  doneBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  doneText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  footer: { marginTop: spacing.lg, flexDirection: "row", justifyContent: "center", gap: 16 },
  footerItem: { color: colors.muted, fontSize: 10, fontWeight: "600" },
});
