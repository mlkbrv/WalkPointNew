/**
 * One coupon, and the button that buys it.
 *
 * The purchase is a server transaction: the balance check that matters happens
 * there, inside a lock, because stock and balance can both change between this
 * screen loading and the button being pressed. The local affordability check only
 * decides how the button *looks* — the server's answer decides what happens.
 */

import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { RootStackParamList } from "../types";
import { useServerData } from "../contexts/ServerDataContext";
import { useStepoint } from "../contexts/StepointContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { mediaUrl } from "../api/client";

export function CouponDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, "CouponDetail">>();
  const { coupons, stores, wallet, purchaseCoupon } = useServerData();
  const { showToast } = useStepoint();

  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const couponId = route.params?.couponId;
  const selectedCoupon = useMemo(
    () => coupons.data.find((item) => item.id === couponId) ?? null,
    [coupons.data, couponId],
  );
  const partnerName = useMemo(
    () =>
      stores.data.find((store) => store.id === selectedCoupon?.partner_id)?.company_name ??
      "Partner",
    [stores.data, selectedCoupon],
  );

  if (!selectedCoupon) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Coupon" onBack={() => navigation.goBack()} />
        <GlassCard style={styles.missingCard}>
          <Ionicons name="pricetag-outline" size={32} color={colors.muted} />
          <Text style={styles.missingTitle}>This offer is no longer available</Text>
          <Text style={styles.missingBody}>It may have sold out or ended.</Text>
        </GlassCard>
      </View>
    );
  }

  const stepsCost = selectedCoupon.cost_coins;
  const balance = wallet.data.balance;
  const progressPercent = Math.floor(Math.min(balance / stepsCost, 1) * 100);
  const isAffordable = balance >= stepsCost;

  const handlePurchase = async () => {
    if (buying) return;
    setBuying(true);
    setError(null);

    const result = await purchaseCoupon(selectedCoupon.id);

    setBuying(false);
    if (result.ok) {
      showToast("Coupon added to your wallet", "🎟️");
      navigation.navigate("Wallet");
      return;
    }

    // The server tells us *why*, and the codes are stable enough to act on.
    setError(result.error ?? "Could not buy this coupon.");
    showToast(
      result.code === "INSUFFICIENT_COINS" ? "Not enough coins" : "Purchase failed",
      "😔",
    );
    setTimeout(() => setError(null), 4000);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Coupon Validation" onBack={() => navigation.goBack()} />

        <View style={styles.hero}>
          {selectedCoupon.image_path ? (
            <Image source={{ uri: mediaUrl(selectedCoupon.image_path) }} style={styles.heroImg} />
          ) : (
            <View style={[styles.heroImg, styles.heroFallback]}>
              <Ionicons name="gift-outline" size={40} color={colors.white} />
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.heroMeta}>
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="storefront" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.partner}>{partnerName}</Text>
              <Text style={styles.heroTitle}>{selectedCoupon.title}</Text>
            </View>
          </View>
        </View>

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Requirement Progress</Text>
            <Text style={styles.progressPct}>{progressPercent}% Complete</Text>
          </View>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenNow}>{balance.toLocaleString()}</Text>
            <Text style={styles.tokenNeed}> / {stepsCost.toLocaleString()} coins</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${progressPercent}%` }]} />
          </View>
          {isAffordable ? (
            <View style={styles.okRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.emeraldInk} />
              <Text style={styles.okText}>Requirement achieved! Exchanger available.</Text>
            </View>
          ) : (
            <Text style={styles.needText}>
              Keep moving! Only {(stepsCost - balance).toLocaleString()} more coins until checkout is active.
            </Text>
          )}
        </GlassCard>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not buy this coupon</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.aboutTitle}>About this Offer</Text>
        <Text style={styles.aboutBody}>
          {selectedCoupon.description || selectedCoupon.title}
        </Text>
        {selectedCoupon.rules ? (
          <Text style={styles.aboutBody}>{selectedCoupon.rules}</Text>
        ) : null}

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Ionicons name="ticket-outline" size={16} color={colors.primary} />
            <View>
              <Text style={styles.gridLabel}>Voucher Type</Text>
              <Text style={styles.gridValue}>Digital Code Card</Text>
            </View>
          </View>
          <View style={styles.gridItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.emeraldInk} />
            <View>
              <Text style={styles.gridLabel}>Assurance</Text>
              <Text style={styles.gridValue}>Guaranteed Sync</Text>
            </View>
          </View>
        </View>

        <View style={styles.terms}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsItem}>• Valid for one hand-crafted item up to Grande size.</Text>
          <Text style={styles.termsItem}>• Cannot be combined with other offers or concurrent brand discounts.</Text>
          <Text style={styles.termsItem}>• Code expires in 30 days from checking out voucher.</Text>
        </View>

        <PressableScale
          style={isAffordable && !buying ? styles.buyBtn : [styles.buyBtn, styles.buyDisabled]}
          onPress={handlePurchase}
          disabled={!isAffordable || buying}
        >
          {buying ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={isAffordable ? styles.buyText : [styles.buyText, styles.buyTextDisabled]}>
                CONFIRM PURCHASE
              </Text>
              <Ionicons name="ticket" size={16} color={isAffordable ? colors.white : colors.muted} />
            </>
          )}
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  missingCard: { margin: spacing.lg, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  missingTitle: { fontSize: 17, fontWeight: "400", color: colors.text, textAlign: "center" },
  missingBody: { fontSize: 15, fontWeight: "400", color: colors.slate },
  heroFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  hero: {
    height: 176,
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImg: { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  heroMeta: {
    position: "absolute",
    left: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white },
  partner: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: `${colors.primary}59`,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  heroTitle: { color: colors.white, fontWeight: "600", fontSize: 15, marginTop: 4 },
  progressCard: { padding: 18, marginBottom: spacing.md },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  progressPct: { color: colors.primary, fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  tokenRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10 },
  tokenNow: { color: colors.charcoal, fontSize: 22, fontWeight: "600" },
  tokenNeed: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  barTrack: { height: 10, backgroundColor: "#F1F5F9", borderRadius: radii.full, overflow: "hidden", marginTop: 12 },
  barFill: { height: "100%", backgroundColor: colors.primary, borderRadius: radii.full },
  okRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  okText: { color: colors.emeraldInk, fontSize: 12, fontWeight: "600" },
  needText: { color: colors.slate, fontSize: 12, marginTop: 10, lineHeight: 15 },
  errorBox: {
    backgroundColor: "rgba(255,107,82,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,107,82,0.3)",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: spacing.md,
  },
  errorTitle: { color: colors.coralInk, fontWeight: "600", fontSize: 13 },
  errorBody: { color: colors.slate, fontSize: 12, marginTop: 4, lineHeight: 14 },
  aboutTitle: { color: colors.charcoal, fontWeight: "600", fontSize: 15, marginTop: spacing.sm },
  aboutBody: { color: colors.slate, fontSize: 13, lineHeight: 18, marginTop: 6 },
  grid: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  gridItem: {
    flex: 1,
    backgroundColor: colors.inputSurface,
    borderRadius: radii.lg,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  gridValue: { color: colors.charcoal, fontSize: 12, fontWeight: "600", marginTop: 2 },
  terms: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  termsTitle: { color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  termsItem: { color: colors.slate, fontSize: 12, lineHeight: 16, marginBottom: 4 },
  buyBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buyDisabled: { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: colors.border },
  buyText: { color: colors.white, fontWeight: "600", fontSize: 13, letterSpacing: 1 },
  buyTextDisabled: { color: colors.muted },
}));
