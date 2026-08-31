import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { EmptyState } from "../components/EmptyState";
import { GlassCard } from "../components/GlassCard";
import { useServerData } from "../contexts/ServerDataContext";
import type { ApiCoupon } from "../api/endpoints";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function StoreScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{ navigate: (s: string, p?: object) => void }>();
  const insets = useSafeAreaInsets();
  const { wallet, coupons, stores, refreshCatalogue } = useServerData();
  const [storeFilter, setStoreFilter] = useState<string>("All");

  // Coming back from a purchase should show the new balance and the new stock.
  useFocusEffect(
    useCallback(() => {
      void refreshCatalogue();
    }, [refreshCatalogue]),
  );

  const tokens = wallet.data.balance;
  const coldLoading = coupons.loading && !coupons.loaded;

  // The catalogue is filtered by business rather than by an invented category:
  // the API models a coupon as belonging to a partner, and inventing categories
  // client-side would put labels on screen that nothing on the server backs.
  const storeName = useMemo(() => {
    const byId = new Map(stores.data.map((store) => [store.id, store.company_name]));
    return (partnerId: string) => byId.get(partnerId) ?? "Partner";
  }, [stores.data]);

  const filters = useMemo(
    () => ["All", ...stores.data.map((store) => store.company_name)],
    [stores.data],
  );

  const filtered = useMemo(
    () =>
      storeFilter === "All"
        ? coupons.data
        : coupons.data.filter((coupon) => storeName(coupon.partner_id) === storeFilter),
    [coupons.data, storeFilter, storeName],
  );

  const openCoupon = (item: ApiCoupon) => {
    navigation.navigate("CouponDetail", { couponId: item.id });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Rewards Store</Text>
            <Text style={styles.sub}>Exchange Steps for Perks</Text>
          </View>
          <PressableScale style={styles.tokenPill} onPress={() => navigation.navigate("Wallet")}>
            <Text style={styles.tokenLabel}>Wallet</Text>
            <Text style={styles.tokenValue}>{tokens.toLocaleString()} ST</Text>
          </PressableScale>
        </View>

        <Text style={styles.blurb}>
          Redeem your hard-earned steps for exclusive product discounts, free meals, and premium apparel coupons.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {filters.map((cat) => (
            <PressableScale
              key={cat}
              style={[styles.chip, storeFilter === cat && styles.chipActive]}
              onPress={() => setStoreFilter(cat)}
            >
              <Text style={[styles.chipText, storeFilter === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>

        {coldLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : coupons.error && coupons.data.length === 0 ? (
          <EmptyState
            art="offline"
            title="Could not load the store"
            body={coupons.error ?? undefined}
            actionLabel="Try again"
            onAction={() => void refreshCatalogue()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            art="store"
            title="No offers yet"
            body="Partner coupons appear here once a moderator approves them."
          />
        ) : (
          <View style={styles.grid}>
            {filtered.map((perk) => {
              const affordable = tokens >= perk.cost_coins;
              return (
                // The percentage width has to live on a plain View, not on
                // PressableScale: it wraps its content in its own unstyled
                // Animated.View, and a percentage passed to it would resolve
                // against that wrapper — which has no width of its own — not
                // against this grid row. That mismatch was rendering every
                // card at its own text's minimum width, with the rest of its
                // 47.5% column left as blank gap.
                <View key={perk.id} style={styles.cardWrap}>
                  <PressableScale onPress={() => openCoupon(perk)}>
                    <GlassCard style={styles.card}>
                      <View style={styles.imageWrap}>
                        {perk.image_path ? (
                          <Image source={{ uri: perk.image_path }} style={styles.image} />
                        ) : (
                          <View style={[styles.image, styles.imageFallback]}>
                            <Ionicons name="gift-outline" size={28} color={colors.primary} />
                          </View>
                        )}
                        <View style={styles.catBadge}>
                          <Text style={styles.catText}>
                            {perk.quantity_remaining > 0
                              ? `${perk.quantity_remaining} left`
                              : "Sold out"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cardBody}>
                        <Text style={styles.brand}>{storeName(perk.partner_id)}</Text>
                        <Text style={styles.perkTitle} numberOfLines={2}>{perk.title}</Text>
                        <View style={affordable ? styles.costBtn : [styles.costBtn, styles.costBtnMuted]}>
                          <Text
                            style={affordable ? styles.costText : [styles.costText, styles.costTextMuted]}
                          >
                            {perk.cost_coins.toLocaleString()}{" "}
                            <Text style={styles.costUnit}>ST</Text>
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  </PressableScale>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  stateBox: { paddingVertical: 48, alignItems: "center" },
  stateCard: { padding: 24, alignItems: "center", gap: 8 },
  stateTitle: { fontSize: 17, fontWeight: "400", color: colors.text },
  stateBody: { fontSize: 15, fontWeight: "400", color: colors.slate, textAlign: "center" },
  imageFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.border },
  retry: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "400", fontSize: 15 },
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 140, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.charcoal },
  sub: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
  },
  tokenPill: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: `${colors.primary}33`,
    borderRadius: radii.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  tokenValue: { fontSize: 13, fontWeight: "600", color: colors.primary, marginTop: 2 },
  blurb: { fontSize: 13, color: colors.slate, lineHeight: 18, maxWidth: 320 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.slate },
  chipTextActive: { color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  cardWrap: { width: "47.5%" },
  card: { overflow: "hidden" },
  imageWrap: { height: 112, width: "100%" },
  image: { width: "100%", height: "100%" },
  catBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
  },
  cardBody: { padding: 14, gap: 6 },
  brand: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  perkTitle: { fontSize: 15, fontWeight: "600", color: colors.charcoal, minHeight: 34 },
  costBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  costBtnMuted: { backgroundColor: colors.border },
  costText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  costTextMuted: { color: colors.muted },
  costUnit: { fontSize: 11, fontWeight: "400" },
}));
