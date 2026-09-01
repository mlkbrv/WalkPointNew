import React from "react";
import {
  Image,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, shadows } from "../theme";
import { useTheme } from "../contexts/ThemeContext";
import { PressableScale } from "../components/PressableScale";
import { Avatar } from "../components/Avatar";
import { GlassCard } from "../components/GlassCard";
import { useStride } from "../contexts/StrideContext";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";
import { StoriesRail } from "../components/StoriesRail";
import { useSeenStories } from "../hooks/useSeenStories";
import { useStepHistory } from "../hooks/useStepHistory";
import { useServerData } from "../contexts/ServerDataContext";
import { makeStyles } from "../contexts/ThemeContext";

const RING = 90;
const RING_SIZE = 192;
const CIRC = 2 * Math.PI * RING;

/** Weekday initial for a `YYYY-MM-DD` date, read as local time rather than UTC. */
function weekdayInitial(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(year, month - 1, day).getDay()];
}

export function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{ navigate: (s: string, p?: object) => void; getParent?: () => { navigate: (s: string) => void } | undefined }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const health = useHealth();
  const { userStats } = useStride();
  const { seenIds, reload: reloadSeen } = useSeenStories();
  const { storyGroups, stores, unreadCount } = useServerData();
  const week = useStepHistory();

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
  const unread = unreadCount > 0;
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
              <Avatar uri={user?.avatar} name={user?.name} size={44} />
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
            <Ionicons name="fitness-outline" size={18} color={colors.coralInk} />
            <View style={styles.healthTextWrap}>
              <Text style={styles.healthTitle}>Health access needed</Text>
              <Text style={styles.healthBody}>Connect sensors to track real steps — metrics stay at 0 until then</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.coralInk} />
          </PressableScale>
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
              <Text style={styles.goal}>of {stepsGoal.toLocaleString()}</Text>
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
            <Ionicons name="stats-chart-outline" size={16} color={colors.white} />
            <Text style={styles.trackCtaText}>See your activity</Text>
          </PressableScale>
        </GlassCard>

        {/* One entry per tile, so the icon, value and unit cannot drift apart.
            A half-finished refactor here had rendered "kcal" three times and a
            literal "[km|mins]" placeholder, five tiles where there are three. */}
        <View style={styles.statsRow}>
          {(
            [
              { key: "calories", icon: "flame", value: caloriesKcal, unit: "kcal", accent: false },
              { key: "distance", icon: "navigate", value: distanceKm, unit: "km", accent: true },
              { key: "duration", icon: "timer-outline", value: durationMins, unit: "min", accent: false },
            ] as const
          ).map((stat) => (
            <GlassCard key={stat.key} style={styles.statCard}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: stat.accent ? colors.primaryTint : colors.inputSurface },
                ]}
              >
                <Ionicons
                  name={stat.icon}
                  size={16}
                  color={stat.accent ? colors.primary : colors.coralInk}
                />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.unit}</Text>
            </GlassCard>
          ))}
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
                  {week.changePercent === null ? (
                    `${week.thisWeek.toLocaleString()} steps in the last 7 days`
                  ) : (
                    <>
                      You&apos;re{" "}
                      <Text style={{ color: week.changePercent >= 0 ? colors.primary : colors.coralInk }}>
                        {Math.abs(week.changePercent)}% {week.changePercent >= 0 ? "more" : "less"} active
                      </Text>{" "}
                      than last week
                    </>
                  )}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>
            <View style={styles.bars}>
              {week.days.length === 0 ? (
                <Text style={styles.weekEmpty}>
                  {week.loading ? "Loading your week\u2026" : "No steps recorded yet this week."}
                </Text>
              ) : (
                week.days.map((info) => {
                  const isToday = info.date === new Date().toISOString().slice(0, 10);
                  const h = Math.max(4, Math.min((info.steps / 15000) * 80, 80));
                  return (
                    <View key={info.date} style={styles.barCol}>
                      {isToday ? (
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
                              backgroundColor: isToday ? colors.primary : colors.border,
                            },
                          ]}
                        />
                        <Text style={[styles.barDay, isToday && styles.barDayActive]}>{weekdayInitial(info.date)}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </GlassCard>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  brandLogoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.border },
  root: { flex: 1, backgroundColor: colors.canvas },
  weekEmpty: { color: colors.muted, fontSize: 13, paddingVertical: 20 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  greeting: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.border },
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
  hello: { fontSize: 15, fontWeight: "600", color: colors.charcoal },
  member: { fontSize: 12, fontWeight: "400", color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
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
  healthTitle: { fontSize: 13, fontWeight: "600", color: colors.coralInk },
  healthBody: { fontSize: 12, color: colors.slate, marginTop: 2 },
  ringCard: { padding: 24, alignItems: "center" },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  ringSvg: { transform: [{ rotate: "-90deg" }], position: "absolute" },
  ringCenter: { alignItems: "center" },
  steps: { fontSize: 34, fontWeight: "700", color: colors.charcoal },
  goal: { fontSize: 12, fontWeight: "600", color: colors.muted, letterSpacing: 1, marginTop: 2 },
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
    ...shadows.fab,
  },
  trackCtaText: { color: colors.onPrimary, fontSize: 17, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12 },
  // GlassCard already provides the elevation; a second shadow spread here
  // used to override it with a flatter one, which is why the accented middle
  // tile's shadow and its bottom-border accent looked like they didn't agree
  // with the card's own rounded corner.
  statCard: { flex: 1, padding: 12, alignItems: "center", gap: 6 },
  statIcon: { padding: 8, borderRadius: radii.md },
  statValue: { fontSize: 17, fontWeight: "600", color: colors.charcoal },
  statLabel: { fontSize: 12, fontWeight: "400", color: colors.muted },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.charcoal },
  storeLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  storeLinkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  carousel: { gap: 12, paddingVertical: 4 },
  brandCard: { width: 128 },
  brandInner: { padding: 16, alignItems: "center", gap: 8 },
  brandLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white },
  brandName: { fontSize: 13, fontWeight: "600", color: colors.charcoal, width: 96, textAlign: "center" },
  brandCat: { fontSize: 11, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  weekCard: { padding: 20 },
  weekHead: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  weekLabel: { fontSize: 13, fontWeight: "600", color: colors.slate, textTransform: "uppercase", letterSpacing: 1 },
  weekCopy: { fontSize: 15, fontWeight: "600", color: colors.charcoal, marginTop: 2 },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 110, gap: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  todayTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  todayTagText: { color: colors.white, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  todaySpacer: { height: 16 },
  barTrack: {
    width: 22,
    height: 80,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radii.full },
  barDay: { fontSize: 12, fontWeight: "600", color: colors.muted },
  barDayActive: { color: colors.primary, fontSize: 13, fontWeight: "600" },
}));