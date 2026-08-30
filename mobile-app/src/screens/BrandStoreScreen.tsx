/**
 * One partner's storefront: who they are, and everything they currently offer.
 *
 * Reached from the Home strip and the Store list, both of which pass a
 * `partnerId`. The coupons shown are the live catalogue filtered to that
 * partner — there is no invented "tier" content any more, so an empty store
 * says so rather than showing offers nobody can buy.
 */

import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { RootStackParamList } from "../types";
import { useServerData } from "../contexts/ServerDataContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function BrandStoreScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, "BrandStore">>();
  const partnerId = route.params?.partnerId;

  const { stores, coupons, wallet, refreshCatalogue } = useServerData();

  useFocusEffect(
    useCallback(() => {
      void refreshCatalogue();
    }, [refreshCatalogue]),
  );

  const store = useMemo(
    () => stores.data.find((item) => item.id === partnerId) ?? null,
    [stores.data, partnerId],
  );

  const brandCoupons = useMemo(
    () => coupons.data.filter((coupon) => coupon.partner_id === partnerId),
    [coupons.data, partnerId],
  );

  const coldLoading = (stores.loading || coupons.loading) && !stores.loaded;

  if (coldLoading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Store" onBack={() => navigation.goBack()} />
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Store" onBack={() => navigation.goBack()} />
        <EmptyState
          art="store"
          title="This store is not available"
          body="It may have been taken offline. Try the store list for what is live now."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={store.company_name} onBack={() => navigation.goBack()} />

        <GlassCard style={styles.brandCard}>
          {store.logo_path ? (
            <Image source={{ uri: store.logo_path }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="storefront" size={24} color={colors.primary} />
            </View>
          )}
          <View style={styles.brandMeta}>
            <Text style={styles.brandName}>{store.company_name}</Text>
            {store.description ? (
              <Text style={styles.brandDesc}>{store.description}</Text>
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.balanceRow}>
          <Text style={styles.sectionTitle}>Offers</Text>
          <Text style={styles.balance}>{wallet.data.balance.toLocaleString()} ST</Text>
        </View>

        {brandCoupons.length === 0 ? (
          <EmptyState
            art="store"
            title="No live offers"
            body="Check back when this partner publishes something."
          />
        ) : (
          brandCoupons.map((coupon) => {
            const affordable = wallet.data.balance >= coupon.cost_coins;
            return (
              <PressableScale
                key={coupon.id}
                onPress={() => navigation.navigate("CouponDetail", { couponId: coupon.id })}
              >
                <GlassCard style={styles.couponCard}>
                  <View style={styles.couponBody}>
                    <Text style={styles.couponTitle}>{coupon.title}</Text>
                    <Text style={styles.couponDesc} numberOfLines={2}>
                      {coupon.description || `${coupon.quantity_remaining} left`}
                    </Text>
                  </View>
                  <View style={affordable ? styles.price : [styles.price, styles.priceMuted]}>
                    <Text style={affordable ? styles.priceText : [styles.priceText, styles.priceTextMuted]}>
                      {coupon.cost_coins.toLocaleString()} ST
                    </Text>
                  </View>
                </GlassCard>
              </PressableScale>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 3 },

  stateBox: { paddingVertical: spacing.xxxl, alignItems: "center" },
  stateCard: { padding: spacing.xl, alignItems: "center", gap: spacing.sm, margin: spacing.lg },
  stateTitle: { fontSize: 17, fontWeight: "400", color: colors.text },
  stateBody: { fontSize: 15, fontWeight: "400", color: colors.slate, textAlign: "center" },

  brandCard: { flexDirection: "row", gap: spacing.lg, padding: spacing.lg, alignItems: "center" },
  logo: { width: 56, height: 56, borderRadius: radii.lg },
  logoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.border },
  brandMeta: { flex: 1, gap: 4 },
  brandName: { fontSize: 20, fontWeight: "600", color: colors.text },
  brandDesc: { fontSize: 15, fontWeight: "400", color: colors.slate },

  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: colors.text },
  balance: { fontSize: 15, fontWeight: "600", color: colors.primary },

  couponCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  couponBody: { flex: 1, gap: 4 },
  couponTitle: { fontSize: 17, fontWeight: "400", color: colors.text },
  couponDesc: { fontSize: 15, fontWeight: "400", color: colors.slate },
  price: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  priceMuted: { backgroundColor: colors.border },
  priceText: { fontSize: 15, fontWeight: "600", color: colors.white },
  priceTextMuted: { color: colors.muted },
}));
