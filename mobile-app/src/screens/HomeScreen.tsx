import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { useStride } from "../contexts/StrideContext";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";
import { StoriesRail } from "../components/StoriesRail";
import { useSeenStories } from "../hooks/useSeenStories";
import { useServerData } from "../contexts/ServerDataContext";

const RING = 90;
const RING_SIZE = 192;
const CIRC = 2 * Math.PI * RING;

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const health = useHealth();
  const { userStats, setSelectedBrand, notifications, triggerMockStepsBoost } = useStride();
  const { seenIds, reload: reloadSeen } = useSeenStories();
  const { storyGroups, stores } = useServerData();

  useFocusEffect(
    React.useCallback(() => {
      reloadSeen();
    }, [reloadSeen])
  );

  const stepsToday = userStats.stepsToday;
  const stepsGoal = userStats.stepsGoal;
  const ratio = Math.min(stepsGoal > 0 ? stepsToday / stepsGoal : 0, 1);
  const offset = CIRC - ratio * CIRC;
  const distanceKm = (stepsToday * 0.00075).toFixed(2);
  const caloriesKcal = Math.floor(stepsToday * 0.04);
  const durationMins = Math.floor(stepsToday * 0.0045);
  const unread = notifications.some((n) => !n.read);
  const firstName = (user?.name || "Walker").split(" ")[0];
  const showHealthBanner = health.needsPermission;

  const openInbox = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate("InboxTab");
    else navigation.navigate("InboxTab");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PressableScale style={styles.greeting} onPress={() => navigation.navigate("Profile")}>
            <View style={styles.avatarWrap}>
              <Image
                source={{ uri: user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" }}
                style={styles.avatar}
              />
              <View style={styles.onlineDot} />
            </View>
            <View>
              <Text style={styles.hello}>Hello, {firstName}!</Text>
              <Text style={styles.member}>Active Member</Text>
            </View>
          </PressableScale>

          <View style={styles.headerActions}>
            <PressableScale style={styles.iconBtn} onPress={() => navigation.navigate("Wallet")}>
              <Ionicons name="wallet-outline" size={20} color={colors.charcoal} />
            </PressableScale>
            <PressableScale style={styles.iconBtn} onPress={openInbox}>
              <Ionicons name="notifications-outline" size={20} color={colors.charcoal} />
              {unread ? <View style={styles.badge} /> : null}
            </PressableScale>
          </View>
        </View>

        <StoriesRail
          stories={storyGroups}
          seenIds={seenIds}
          onOpen={(id) => navigation.navigate("Stories", { startId: id })}
        />

        {showHealthBanner ? (
          <PressableScale
            style={styles.healthBanner}
            onPress={() => navigation.navigate("HealthSetup")}
          >
            <Ionicons name="fitness-outline" size={18} color={colors.coral} />
            <View style={styles.healthTextWrap}>
              <Text style={styles.healthTitle}>Health access needed</Text>
              <Text style={styles.healthBody}>Connect sensors to track real steps — metrics stay at 0 until then</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.coral} />
          </PressableScale>
        ) : null}

        {health.mockMode ? (
          <View style={styles.devBar}>
            <Text style={styles.devTitle}>Developer Mock Mode</Text>
            <Text style={styles.devMeta}>
              {userStats.totalTokens.toLocaleString()} tokens · {stepsToday.toLocaleString()} steps
            </Text>
            <View style={styles.devRow}>
              <PressableScale style={styles.devBtn} onPress={() => triggerMockStepsBoost(1000)}>
                <Text style={styles.devBtnText}>+1,000 Steps</Text>
              </PressableScale>
              <PressableScale style={styles.devBtn} onPress={() => triggerMockStepsBoost(5000)}>
                <Text style={styles.devBtnText}>+5,000 Steps</Text>
              </PressableScale>
              <PressableScale
                style={[styles.devBtn, styles.devOff]}
                onPress={() => health.setMockMode(false)}
              >
                <Text style={styles.devBtnText}>Exit Mock</Text>
              </PressableScale>
            </View>
          </View>
        ) : null}

        <GlassCard style={styles.ringCard}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING}
                stroke={colors.border}
                strokeWidth={10}
                fill="transparent"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING}
                stroke={colors.primary}
                strokeWidth={10}
                fill="transparent"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.steps}>{stepsToday.toLocaleString()}</Text>
              <Text style={styles.goal}>GOAL: {stepsGoal.toLocaleString()}</Text>
            </View>
          </View>

          <PressableScale
            style={styles.trackCta}
            onPress={() => {
              const parent = navigation.getParent?.();
              if (parent) parent.navigate("TrackTab");
              else navigation.navigate("TrackTab");
            }}
          >
            <Ionicons name="sparkles" size={16} color={colors.emerald} />
            <Text style={styles.trackCtaText}>START TRACKING WORKOUT</Text>
          </PressableScale>
        </GlassCard>

        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(255,107,82,0.12)" }]}>
              <Ionicons name="flame" size={16} color={colors.coral} />
            </View>
            <Text style={styles.statValue}>{caloriesKcal}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </GlassCard>
          <GlassCard style={[styles.statCard, styles.statHighlight]}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(129,64,243,0.12)" }]}>
              <Ionicons name="navigate" size={16} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{distanceKm}</Text>
            <Text style={styles.statLabel}>km</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(0,225,148,0.12)" }]}>
              <Ionicons name="timer-outline" size={16} color={colors.emerald} />
            </View>
            <Text style={styles.statValue}>{durationMins}</Text>
            <Text style={styles.statLabel}>mins</Text>
          </GlassCard>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Premium Brand Partners</Text>
          <PressableScale
            style={styles.storeLink}
            onPress={() => {
              const parent = navigation.getParent?.();
              if (parent) parent.navigate("StoreTab");
              else navigation.navigate("StoreTab");
            }}
          >
            <Text style={styles.storeLinkText}>Store</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </PressableScale>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {stores.data.map((store) => (
            <PressableScale
              key={store.id}
              style={styles.brandCard}
              onPress={() => navigation.navigate("BrandStore", { partnerId: store.id })}
            >
              <GlassCard style={styles.brandInner}>
                {store.logo_path ? (
                  <Image source={{ uri: store.logo_path }} style={styles.brandLogo} />
                ) : (
                  <View style={[styles.brandLogo, styles.brandLogoFallback]}>
                    <Ionicons name="storefront" size={18} color={colors.primary} />
                  </View>
                )}
                <Text style={styles.brandName} numberOfLines={1}>{store.company_name}</Text>
                <Text style={styles.brandCat} numberOfLines={1}>
                  {store.description || "Partner"}
                </Text>
              </GlassCard>
            </PressableScale>
          ))}
        </ScrollView>

        <PressableScale onPress={() => navigation.navigate("PerformanceReport")}>
          <GlassCard style={styles.weekCard}>
            <View style={styles.weekHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.weekLabel}>Weekly Momentum</Text>
                <Text style={styles.weekCopy}>
                  You're <Text style={{ color: colors.primary }}>12% more active</Text> than last week!
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
            <View style={styles.bars}>
              {userStats.weeklySteps.map((info, idx) => {
                const h = Math.max(4, Math.min((info.steps / 15000) * 80, 80));
                return (
                  <View key={`${info.day}-${idx}`} style={styles.barCol}>
                    {info.isToday ? (
                      <View style={styles.todayTag}>
                        <Text style={styles.todayTagText}>Today</Text>
                      </View>
                    ) : (
                      <View style={styles.todaySpacer} />
                    )}
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: h,
                            backgroundColor: info.isToday ? colors.primary : "rgba(129,64,243,0.3)",
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barDay, info.isToday && styles.barDayActive]}>{info.day}</Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  brandLogoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.border },
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  greeting: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "rgba(129,64,243,0.25)" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.emerald,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hello: { fontSize: 14, fontWeight: "700", color: colors.charcoal },
  member: { fontSize: 10, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },
  healthBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,107,82,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,107,82,0.25)",
    borderRadius: radii.lg,
    padding: 12,
  },
  healthTextWrap: { flex: 1 },
  healthTitle: { fontSize: 12, fontWeight: "800", color: colors.coral },
  healthBody: { fontSize: 10, color: colors.slate, marginTop: 2 },
  devBar: {
    backgroundColor: colors.charcoal,
    borderRadius: radii.lg,
    padding: 14,
    gap: 8,
  },
  devTitle: { color: colors.emerald, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  devMeta: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  devRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  devBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  devOff: { backgroundColor: colors.coral },
  devBtnText: { color: colors.white, fontWeight: "800", fontSize: 10 },
  ringCard: { padding: 24, alignItems: "center" },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ringSvg: { transform: [{ rotate: "-90deg" }], position: "absolute" },
  ringCenter: { alignItems: "center" },
  steps: { fontSize: 30, fontWeight: "800", color: colors.charcoal },
  goal: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 1, marginTop: 2 },
  trackCta: {
    marginTop: 24,
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  trackCtaText: { color: colors.white, fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, padding: 12, alignItems: "center", gap: 6 },
  statHighlight: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  statIcon: { padding: 8, borderRadius: radii.md },
  statValue: { fontSize: 16, fontWeight: "800", color: colors.charcoal },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.muted },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.charcoal },
  storeLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  storeLinkText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  carousel: { gap: 12, paddingVertical: 4 },
  brandCard: { width: 128 },
  brandInner: { padding: 16, alignItems: "center", gap: 8 },
  brandLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white },
  brandName: { fontSize: 12, fontWeight: "700", color: colors.charcoal, width: 96, textAlign: "center" },
  brandCat: { fontSize: 9, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  weekCard: { padding: 20 },
  weekHead: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  weekLabel: { fontSize: 11, fontWeight: "700", color: colors.slate, textTransform: "uppercase", letterSpacing: 1 },
  weekCopy: { fontSize: 13, fontWeight: "700", color: colors.charcoal, marginTop: 2 },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 110, gap: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  todayTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  todayTagText: { color: colors.white, fontSize: 8, fontWeight: "900", textTransform: "uppercase" },
  todaySpacer: { height: 16 },
  barTrack: {
    width: "100%",
    height: 80,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radii.full },
  barDay: { fontSize: 10, fontWeight: "700", color: colors.muted },
  barDayActive: { color: colors.primary, fontSize: 12, fontWeight: "900" },
});
