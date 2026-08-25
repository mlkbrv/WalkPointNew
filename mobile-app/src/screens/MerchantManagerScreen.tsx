import React from "react";
import { Image, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride } from "../contexts/StrideContext";
import { colors, radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";

export function MerchantManagerScreen() {
  const navigation = useNavigation<any>();
  const { merchantCoupons, toggleMerchantCoupon } = useStride();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Merchant Manager" onBack={() => navigation.goBack()} />

        <View style={styles.actions}>
          <PressableScale style={styles.primaryBtn} onPress={() => navigation.navigate("CreateCoupon")}>
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.primaryText}>Create Coupon</Text>
          </PressableScale>
          <PressableScale style={styles.secondaryBtn} onPress={() => navigation.navigate("MerchantScanner")}>
            <Ionicons name="scan-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>Scanner</Text>
          </PressableScale>
        </View>

        <Text style={styles.section}>Your Coupons</Text>

        {merchantCoupons.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="storefront-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>No coupons yet</Text>
            <Text style={styles.emptyBody}>Publish your first offer to start tracking redemptions.</Text>
          </GlassCard>
        ) : (
          merchantCoupons.map((c) => (
            <GlassCard key={c.id} style={styles.card}>
              <View style={styles.row}>
                <Image source={{ uri: c.logo || c.image }} style={styles.logo} />
                <View style={styles.meta}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.sub}>
                    {c.category} • {c.stepsCost.toLocaleString()} ST
                  </Text>
                </View>
                <Switch
                  value={c.published}
                  onValueChange={() => toggleMerchantCoupon(c.id)}
                  trackColor={{ false: "#CBD5E1", true: colors.emerald }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{c.redemptions}</Text>
                  <Text style={styles.statLabel}>Redeems</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{c.views}</Text>
                  <Text style={styles.statLabel}>Views</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{c.discountPercent ?? 0}%</Text>
                  <Text style={styles.statLabel}>Discount</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: c.published ? colors.emerald : colors.muted }]}>
                    {c.published ? "Live" : "Off"}
                  </Text>
                  <Text style={styles.statLabel}>Status</Text>
                </View>
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
  actions: { flexDirection: "row", gap: 10, marginBottom: spacing.lg },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(129,64,243,0.08)",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.25)",
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  section: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  empty: { padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.charcoal, fontWeight: "800", fontSize: 14 },
  emptyBody: { color: colors.muted, fontSize: 12, textAlign: "center" },
  card: { padding: 14, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 10 },
  meta: { flex: 1 },
  title: { color: colors.charcoal, fontWeight: "800", fontSize: 14 },
  sub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  stats: { flexDirection: "row", marginTop: 14, gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: { color: colors.charcoal, fontWeight: "900", fontSize: 13 },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", marginTop: 2, textTransform: "uppercase" },
});
