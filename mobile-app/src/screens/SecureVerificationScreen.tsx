/**
 * The code a customer shows at the counter.
 *
 * This screen used to draw a decorative grid of squares and a "rolling code"
 * derived from `Math.sin(tick)` — neither was scannable and neither meant
 * anything. What a voucher actually is, is the `qr_token` UUID the server
 * generated at purchase, so that is what the QR encodes and what the partner's
 * scanner reads back.
 *
 * There is no expiry countdown either: the token does not rotate. The voucher
 * is valid until it is redeemed or its coupon's window closes, and the screen
 * shows that real date instead of inventing a 30-second timer.
 */

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { describeError } from "../api/client";
import { walletApi, type ApiVoucher } from "../api/endpoints";
import { useStride } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import type { RootStackParamList } from "../types";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import type { Palette } from "../theme";

function statusCopy(colors: Palette) {
  return {
    active: { icon: "shield-checkmark", tint: colors.emeraldInk, label: "Ready to redeem" },
    used: { icon: "checkmark-done", tint: colors.muted, label: "Already redeemed" },
    expired: { icon: "time-outline", tint: colors.coralInk, label: "Expired" },
  } as const;
}

export function SecureVerificationScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{ canGoBack: () => boolean; goBack: () => void; navigate: (s: string) => void }>();
  const route = useRoute<RouteProp<RootStackParamList, "SecureVerification">>();
  const { showToast } = useStride();

  const [voucher, setVoucher] = useState<ApiVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const voucherId = route.params?.voucherId;

  useEffect(() => {
    if (!voucherId) {
      setError("No voucher was selected.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const found = await walletApi.voucher(voucherId);
        if (!cancelled) setVoucher(found);
      } catch (caught) {
        if (!cancelled) setError(describeError(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voucherId]);

  const copyCode = useCallback(async () => {
    if (!voucher) return;
    await Clipboard.setStringAsync(voucher.qr_token);
    showToast("Code copied", "📋");
  }, [voucher, showToast]);

  const onDone = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Main");
  }, [navigation]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !voucher) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Secure Access" onBack={onDone} />
          <GlassCard style={styles.card}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.coralInk} />
            <Text style={styles.title}>Could not open this voucher</Text>
            <Text style={styles.sub}>{error ?? "It is no longer in your wallet."}</Text>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  const status = statusCopy(colors)[voucher.status];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Secure Access" onBack={onDone} />

        <GlassCard style={styles.card}>
          <View style={[styles.securePill, { borderColor: `${status.tint}55` }]}>
            <Ionicons name={status.icon} size={14} color={status.tint} />
            <Text style={[styles.secureText, { color: status.tint }]}>{status.label}</Text>
          </View>

          <Text style={styles.title}>{voucher.coupon.title}</Text>
          <Text style={styles.sub}>Show this to the partner at the counter</Text>

          {/* Dimmed once spent, so a used voucher cannot be passed off as live. */}
          <View style={[styles.qrBox, voucher.status !== "active" && styles.qrSpent]}>
            <QRCode
              value={voucher.qr_token}
              size={200}
              backgroundColor="white"
              color={colors.charcoal}
            />
          </View>

          <Text style={styles.code} selectable>
            {voucher.qr_token}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Paid</Text>
            <Text style={styles.metaValue}>{voucher.cost_paid.toLocaleString()} coins</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>
              {voucher.used_at ? "Redeemed" : "Valid until"}
            </Text>
            <Text style={styles.metaValue}>
              {new Date(voucher.used_at ?? voucher.coupon.ends_at).toLocaleDateString()}
            </Text>
          </View>

          <PressableScale style={styles.copyBtn} onPress={() => void copyCode()}>
            <Ionicons name="copy-outline" size={16} color={colors.primary} />
            <Text style={styles.copyText}>Copy code</Text>
          </PressableScale>
        </GlassCard>

        <Text style={styles.footnote}>
          The partner scans this once. After that the voucher is spent and the code stops
          working — it is not a password, so there is no harm in it being visible.
        </Text>

        <PressableScale style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>DONE</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  card: { padding: 24, alignItems: "center", gap: 10 },
  securePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  secureText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { color: colors.charcoal, fontWeight: "800", fontSize: 20, textAlign: "center" },
  sub: { color: colors.slate, fontSize: 12, textAlign: "center" },
  qrBox: {
    marginTop: 10,
    padding: 16,
    // Stays white in both themes on purpose: a QR scanner needs the light quiet
    // zone around the code, and an inverted one often will not read at all.
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrSpent: { opacity: 0.25 },
  code: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 4,
  },
  metaLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  metaValue: { color: colors.charcoal, fontSize: 12, fontWeight: "800" },
  copyBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  copyText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  footnote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  doneBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
}));
