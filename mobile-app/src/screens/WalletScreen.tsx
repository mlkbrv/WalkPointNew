import React, { useCallback } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { ApiVoucher } from "../api/endpoints";
import { useServerData } from "../contexts/ServerDataContext";
import { useAuth } from "../contexts/AuthContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { mediaUrl } from "../api/client";

export function WalletScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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
            <Avatar uri={user?.avatar} name={user?.name} size={36} />
            <Text style={styles.brand}>Stepoint</Text>
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
          <EmptyState
            art="offline"
            title="Could not load your coupons"
            body={vouchers.error ?? undefined}
            actionLabel="Try again"
            onAction={() => void refreshWallet()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            art="wallet"
            title="No coupons yet"
            body="Walk to earn coins, then spend them on partner offers in the Store."
          />
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
                  <Image source={{ uri: mediaUrl(voucher.coupon.image_path) }} style={styles.ticketImg} />
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
            Walk 5,000 more steps today to unlock your next exclusive reward voucher on Stepoint!
          </Text>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  loading: { paddingVertical: spacing.xxxl, alignItems: "center" },
  retry: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "400", fontSize: 15 },
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: `${colors.primary}40` },
  brand: { color: colors.primary, fontWeight: "600", fontSize: 20, letterSpacing: 1 },
  tokenChip: {
    backgroundColor: `${colors.primary}1A`,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  tokenLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  tokenValue: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  sub: { color: colors.slate, fontSize: 13, lineHeight: 18, marginBottom: spacing.lg, marginTop: -8 },
  empty: { padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.charcoal, fontWeight: "600", fontSize: 15 },
  emptyBody: { color: colors.muted, fontSize: 13, textAlign: "center", maxWidth: 220 },
  ticket: {
    flexDirection: "row",
    backgroundColor: colors.card,
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
  ticketCat: { color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginTop: 8, textTransform: "uppercase" },
  ticketRight: { flex: 1, padding: 16, justifyContent: "space-between" },
  ticketTitle: { color: colors.charcoal, fontWeight: "600", fontSize: 15 },
  ticketBrand: { color: colors.muted, fontSize: 12, fontWeight: "400", marginTop: 4 },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 12,
  },
  revealText: { color: colors.primary, fontWeight: "600", fontSize: 12, letterSpacing: 0.5 },
  usedText: { color: colors.muted, fontWeight: "600", fontSize: 12, letterSpacing: 1 },
  nudge: { padding: 20, alignItems: "center", gap: 10, marginTop: spacing.sm },
  nudgeText: { color: colors.slate, fontSize: 13, textAlign: "center", lineHeight: 18 },
}));
