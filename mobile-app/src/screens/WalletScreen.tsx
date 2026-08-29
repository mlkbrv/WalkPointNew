import React, { useCallback } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { ApiVoucher } from "../api/endpoints";
import { useServerData } from "../contexts/ServerDataContext";
import { useAuth } from "../contexts/AuthContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function WalletScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { wallet, vouchers, refreshWallet } = useServerData();

  // Coming back from a purchase or a scan should show the new state, not the
  // state this screen happened to load the first time it mounted.
  useFocusEffect(
    useCallback(() => {
      void refreshWallet();
    }, [refreshWallet]),
  );

  const reveal = (voucher: ApiVoucher) => {
    if (voucher.status !== "active") return;
    navigation.navigate("SecureVerification", { voucherId: voucher.id });
  };

  const items = vouchers.data;
  // Render from the last good response while revalidating; only spin on a cold load.
  const coldLoading = vouchers.loading && !vouchers.loaded;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Image
              source={{ uri: user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80" }}
              style={styles.avatar}
            />
            <Text style={styles.brand}>STRIDE</Text>
          </View>
          <View style={styles.tokenChip}>
            <Text style={styles.tokenLabel}>Balance</Text>
            <Text style={styles.tokenValue}>{wallet.data.balance.toLocaleString()} ST</Text>
          </View>
        </View>

        <ScreenHeader title="Coupons Vault" onBack={() => navigation.goBack()} />
        <Text style={styles.sub}>Redeem your earned performance tokens for lifestyle rewards.</Text>

        {coldLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : vouchers.error && items.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.coralInk} />
            <Text style={styles.emptyTitle}>Could not load your coupons</Text>
            <Text style={styles.emptyBody}>{vouchers.error}</Text>
            <PressableScale style={styles.retry} onPress={() => void refreshWallet()}>
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </GlassCard>
        ) : items.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="ticket-outline" size={40} color={colors.muted} />
            <Text style={styles.emptyTitle}>No active coupons</Text>
            <Text style={styles.emptyBody}>Head to the Rewards Store and purchase perks with your step tokens.</Text>
          </GlassCard>
        ) : (
          items.map((voucher) => (
            <PressableScale
              key={voucher.id}
              style={voucher.status === "active" ? styles.ticket : [styles.ticket, styles.ticketUsed]}
              onPress={() => reveal(voucher)}
              disabled={voucher.status !== "active"}
            >
              <View style={styles.ticketLeft}>
                {voucher.coupon.image_path ? (
                  <Image source={{ uri: voucher.coupon.image_path }} style={styles.ticketImg} />
                ) : (
                  <View style={styles.ticketImg}>
                    <Ionicons name="ticket" size={22} color={colors.primary} />
                  </View>
                )}
                <Text style={styles.ticketCat}>{voucher.cost_paid} ST</Text>
              </View>
              <View style={styles.ticketRight}>
                <Text style={styles.ticketTitle}>{voucher.coupon.title}</Text>
                <Text style={styles.ticketBrand}>
                  Valid until {new Date(voucher.coupon.ends_at).toLocaleDateString()}
                </Text>
                <View style={styles.ticketFooter}>
                  {voucher.status === "used" ? (
                    <Text style={styles.usedText}>USED</Text>
                  ) : voucher.status === "expired" ? (
                    <Text style={styles.usedText}>EXPIRED</Text>
                  ) : (
                    <Text style={styles.revealText}>TAP TO REVEAL</Text>
                  )}
                  <Ionicons
                    name={voucher.status === "active" ? "ticket-outline" : "checkmark-circle"}
                    size={16}
                    color={voucher.status === "active" ? colors.primary : colors.muted}
                  />
                </View>
              </View>
            </PressableScale>
          ))
        )}

        <GlassCard style={styles.nudge}>
          <Ionicons name="trending-up" size={22} color={colors.primary} />
          <Text style={styles.nudgeText}>
            Walk 5,000 more steps today to unlock your next exclusive reward voucher on STRIDE!
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: spacing.xxxl, alignItems: "center" },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "600", fontSize: 14 },
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "rgba(129,64,243,0.25)" },
  brand: { color: colors.primary, fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  tokenChip: {
    backgroundColor: "rgba(129,64,243,0.1)",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.2)",
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  tokenLabel: { color: colors.muted, fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  tokenValue: { color: colors.primary, fontWeight: "900", fontSize: 12 },
  sub: { color: colors.slate, fontSize: 12, lineHeight: 18, marginBottom: spacing.lg, marginTop: -8 },
  empty: { padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 14 },
  emptyBody: { color: colors.muted, fontSize: 12, textAlign: "center", maxWidth: 220 },
  ticket: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
    minHeight: 120,
  },
  ticketUsed: { opacity: 0.55 },
  ticketLeft: {
    width: "32%",
    backgroundColor: "#F8FAFC",
    borderRightWidth: 2,
    borderRightColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  ticketImg: { width: 52, height: 52, borderRadius: 26 },
  ticketCat: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.8, marginTop: 8, textTransform: "uppercase" },
  ticketRight: { flex: 1, padding: 16, justifyContent: "space-between" },
  ticketTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 14 },
  ticketBrand: { color: colors.muted, fontSize: 10, fontWeight: "600", marginTop: 4 },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 12,
  },
  revealText: { color: colors.primary, fontWeight: "800", fontSize: 10, letterSpacing: 0.5 },
  usedText: { color: colors.muted, fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  nudge: { padding: 20, alignItems: "center", gap: 10, marginTop: spacing.sm },
  nudgeText: { color: colors.slate, fontSize: 12, textAlign: "center", lineHeight: 18 },
});
