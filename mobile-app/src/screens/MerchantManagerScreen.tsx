/**
 * A partner's own coupons.
 *
 * The old on/off switch here was a lie: a partner cannot publish anything by
 * itself. Every offer runs `draft → pending → approved | rejected`, and only a
 * superadmin moves it across the middle. So the control is "submit for review"
 * / "withdraw", the status is shown as it really is, and a rejection shows the
 * moderator's reason instead of silently reverting to off.
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { describeError } from "../api/client";
import {
  businessApi,
  type ApiOwnCoupon,
  type ApiPartnerStats,
  type ModerationStatus,
} from "../api/endpoints";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

const STATUS_LABEL: Record<ModerationStatus, string> = {
  draft: "Draft",
  pending: "In review",
  approved: "Live",
  rejected: "Rejected",
};

const STATUS_COLOR: Record<ModerationStatus, string> = {
  draft: colors.muted,
  // Amber darkened to 4.5:1 on white; the usual #F59E0B is 2.15:1.
  pending: "#8A5A00",
  approved: colors.emeraldInk,
  rejected: colors.coralInk,
};

function CouponCard({
  coupon,
  busy,
  onSubmit,
  onWithdraw,
}: {
  coupon: ApiOwnCoupon;
  busy: boolean;
  onSubmit: () => void;
  onWithdraw: () => void;
}) {
  const sold = coupon.quantity_total - coupon.quantity_remaining;
  // Draft and rejected both go forward via submit; the other two come back.
  const canSubmit = coupon.status === "draft" || coupon.status === "rejected";

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.meta}>
          <Text style={styles.title}>{coupon.title}</Text>
          <Text style={styles.sub}>{coupon.cost_coins.toLocaleString()} coins</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[coupon.status]}22` }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[coupon.status] }]}>
            {STATUS_LABEL[coupon.status]}
          </Text>
        </View>
      </View>

      {coupon.status === "rejected" && coupon.rejection_reason ? (
        <Text style={styles.reason}>{coupon.rejection_reason}</Text>
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sold}</Text>
          <Text style={styles.statLabel}>Sold</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{coupon.quantity_redeemed}</Text>
          <Text style={styles.statLabel}>Redeemed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{coupon.quantity_remaining}</Text>
          <Text style={styles.statLabel}>Left</Text>
        </View>
      </View>

      <PressableScale
        style={canSubmit ? styles.submitBtn : styles.withdrawBtn}
        disabled={busy}
        onPress={canSubmit ? onSubmit : onWithdraw}
      >
        <Text style={canSubmit ? styles.submitText : styles.withdrawText}>
          {canSubmit ? "Submit for review" : "Withdraw"}
        </Text>
      </PressableScale>
    </GlassCard>
  );
}

export function MerchantManagerScreen() {
  const navigation = useNavigation<{ navigate: (screen: string) => void; goBack: () => void }>();

  const [coupons, setCoupons] = useState<ApiOwnCoupon[]>([]);
  const [stats, setStats] = useState<ApiPartnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [own, totals] = await Promise.all([businessApi.coupons(), businessApi.stats()]);
      setCoupons(own);
      setStats(totals);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const move = useCallback(
    async (id: string, action: "submit" | "withdraw") => {
      setBusyId(id);
      try {
        const updated =
          action === "submit"
            ? await businessApi.submitCoupon(id)
            : await businessApi.withdrawCoupon(id);
        // The server decides the resulting status; take its row rather than guessing.
        setCoupons((current) => current.map((c) => (c.id === id ? updated : c)));
        void load();
      } catch (caught) {
        setError(describeError(caught));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Merchant Manager" onBack={() => navigation.goBack()} />

        <View style={styles.actions}>
          <PressableScale
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("CreateCoupon")}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Create Coupon</Text>
          </PressableScale>
          <PressableScale
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("MerchantScanner")}
          >
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>Scanner</Text>
          </PressableScale>
        </View>

        {stats ? (
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.live_coupons}</Text>
              <Text style={styles.summaryLabel}>Live</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.pending_coupons}</Text>
              <Text style={styles.summaryLabel}>In review</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.coupons_purchased}</Text>
              <Text style={styles.summaryLabel}>Sold</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.coupons_redeemed}</Text>
              <Text style={styles.summaryLabel}>Redeemed</Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.section}>Your Coupons</Text>

        {loading && coupons.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : coupons.length === 0 ? (
          <EmptyState
            art="store"
            title="No coupons yet"
            body="Create your first offer, then submit it for review."
            actionLabel="Create Coupon"
            onAction={() => navigation.navigate("CreateCoupon")}
          />
        ) : (
          coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              busy={busyId === coupon.id}
              onSubmit={() => void move(coupon.id, "submit")}
              onWithdraw={() => void move(coupon.id, "withdraw")}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  actions: { flexDirection: "row", gap: 10, marginBottom: spacing.lg },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  secondaryBtn: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  summary: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { color: colors.charcoal, fontWeight: "900", fontSize: 18 },
  summaryLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  error: { color: colors.coralInk, fontSize: 12, fontWeight: "600", marginBottom: spacing.md },
  section: {
    marginBottom: spacing.md,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  spinner: { marginTop: spacing.lg },
  empty: { padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 15 },
  emptyBody: { color: colors.slate, fontSize: 12, textAlign: "center" },
  card: { padding: 16, marginBottom: spacing.md, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  meta: { flex: 1 },
  title: { color: colors.charcoal, fontWeight: "800", fontSize: 14 },
  sub: { color: colors.slate, fontSize: 11, fontWeight: "600", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  reason: {
    color: colors.coralInk,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  stats: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center" },
  statValue: { color: colors.charcoal, fontWeight: "800", fontSize: 15 },
  statLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 11,
    alignItems: "center",
  },
  submitText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  withdrawBtn: {
    borderRadius: radii.md,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  withdrawText: { color: colors.slate, fontWeight: "800", fontSize: 12 },
});
