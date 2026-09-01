/**
 * Home.
 *
 * Laid out to match the product's reference design: a compact title bar, the
 * step gauge with its action in the arc's gap, the three metric tiles, and the
 * week strip under a period selector. The partner rail and story rail below
 * them have no counterpart in that reference — they are this product's own
 * commerce surface — so they keep their place and simply adopt the same
 * surfaces and spacing.
 */

import React, { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radii } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { PressableScale } from "../components/PressableScale";
import { Avatar } from "../components/Avatar";
import { GlassCard } from "../components/GlassCard";
import { Gauge } from "../components/Gauge";
import { DayCircleRow } from "../components/DayCircleRow";
import { DropdownChip } from "../components/DropdownChip";
import { StatTileRow, type Stat } from "../components/StatTileRow";
import { StoriesRail } from "../components/StoriesRail";
import { useStride } from "../contexts/StrideContext";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";
import { useSeenStories } from "../hooks/useSeenStories";
import { useStepHistory } from "../hooks/useStepHistory";
import { useServerData } from "../contexts/ServerDataContext";
import { caloriesFromSteps, distanceFromSteps, minutesFromSteps } from "../utils/metrics";

const PERIODS = ["This Week", "Last Week"] as const;
type Period = (typeof PERIODS)[number];

/** "1h 14m", or "14m" below the hour — the reference never shows a bare 0h. */
function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<{
    navigate: (s: string, p?: object) => void;
    getParent?: () => { navigate: (s: string) => void } | undefined;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const health = useHealth();
  const { userStats } = useStride();
  const { seenIds, reload: reloadSeen } = useSeenStories();
  const { storyGroups, stores, unreadCount } = useServerData();
  const week = useStepHistory();
  const [period, setPeriod] = useState<Period>("This Week");

  useFocusEffect(
    React.useCallback(() => {
      reloadSeen();
    }, [reloadSeen]),
  );

  const stepsToday = userStats.stepsToday;
  const stepsGoal = userStats.stepsGoal;
  const unread = unreadCount > 0;
  const lastWeek = period === "Last Week";

  const stats: Stat[] = [
    {
      key: "time",
      icon: "time-outline",
      value: formatMinutes(minutesFromSteps(stepsToday)),
      unit: "time",
      tone: "time",
    },
    {
      key: "calories",
      icon: "flame",
      value: String(caloriesFromSteps(stepsToday)),
      unit: "kcal",
      tone: "calories",
    },
    {
      key: "distance",
      icon: "location",
      value: distanceFromSteps(stepsToday).toFixed(2),
      unit: "km",
      tone: "distance",
    },
  ];

  const openActivity = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate("TrackTab");
    else navigation.navigate("TrackTab");
  };

  const openStore = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate("StoreTab");
    else navigation.navigate("StoreTab");
  };

  const openInbox = () => {
    const parent = navigation.getParent?.();
    if (parent) parent.navigate("InboxTab");
    else navigation.navigate("InboxTab");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale style={styles.greeting} onPress={() => navigation.navigate("Profile")}>
            <View style={styles.avatarWrap}>
              <Avatar uri={user?.avatar} name={user?.name} size={40} />
              <View style={styles.onlineDot} />
            </View>
            <View>
              <Text style={styles.hello}>Hello, {(user?.name || "Walker").split(" ")[0]}!</Text>
              <Text style={styles.member}>Active Member</Text>
            </View>
          </PressableScale>

          <View style={styles.headerActions}>
            <PressableScale style={styles.iconBtn} onPress={openStore}>
              <Ionicons name="bag-outline" size={19} color={colors.charcoal} />
            </PressableScale>
            <PressableScale style={styles.iconBtn} onPress={openInbox}>
              <Ionicons name="notifications-outline" size={19} color={colors.charcoal} />
              {unread ? <View style={styles.badge} /> : null}
            </PressableScale>
          </View>
        </View>

        {health.needsPermission ? (
          <PressableScale
            style={styles.healthBanner}
            onPress={() => navigation.navigate("HealthSetup")}
          >
            <Ionicons name="fitness-outline" size={18} color={colors.coralInk} />
            <View style={styles.healthTextWrap}>
              <Text style={styles.healthTitle}>Health access needed</Text>
              <Text style={styles.healthBody}>
                Connect sensors to track real steps — metrics stay at 0 until then
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.coralInk} />
          </PressableScale>
        ) : null}

        <GlassCard style={styles.gaugeCard}>
          <Gauge value={stepsToday} goal={stepsGoal}>
            <PressableScale style={styles.gaugeFab} onPress={openActivity}>
              <Ionicons name="stats-chart" size={22} color={colors.onPrimary} />
            </PressableScale>
          </Gauge>
        </GlassCard>

        <StatTileRow stats={stats} />

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHead}>
            <Text style={styles.progressTitle}>Your Progress</Text>
            <DropdownChip value={period} options={PERIODS} onChange={setPeriod} />
          </View>
          <DayCircleRow
            days={lastWeek ? week.previousDays : week.days}
            goal={stepsGoal}
            weeksAgo={lastWeek ? 1 : 0}
          />
          <Text style={styles.progressFoot}>
            {lastWeek
              ? `${week.previousWeek.toLocaleString()} steps that week`
              : week.changePercent === null
                ? `${week.thisWeek.toLocaleString()} steps in the last 7 days`
                : `${Math.abs(week.changePercent)}% ${
                    week.changePercent >= 0 ? "more" : "less"
                  } active than last week`}
          </Text>
        </GlassCard>

        <StoriesRail
          stories={storyGroups}
          seenIds={seenIds}
          onOpen={(id) => navigation.navigate("Stories", { startId: id })}
        />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Premium Brand Partners</Text>
          <PressableScale style={styles.storeLink} onPress={openStore}>
            <Text style={styles.storeLinkText}>Store</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </PressableScale>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {stores.data.map((store) => (
            <View key={store.id} style={styles.brandCard}>
              <PressableScale
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
                  <Text style={styles.brandName} numberOfLines={1}>
                    {store.company_name}
                  </Text>
                  <Text style={styles.brandCat} numberOfLines={1}>
                    {store.description || "Partner"}
                  </Text>
                </GlassCard>
              </PressableScale>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 18 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  greeting: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.emerald,
    borderWidth: 2,
    borderColor: colors.card,
  },
  hello: { fontSize: 15, fontWeight: "700", color: colors.charcoal },
  member: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },

  healthBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: `${colors.coralInk}14`,
    borderWidth: 1,
    borderColor: `${colors.coralInk}33`,
    borderRadius: radii.lg,
    padding: 12,
  },
  healthTextWrap: { flex: 1 },
  healthTitle: { fontSize: 13, fontWeight: "700", color: colors.coralInk },
  healthBody: { fontSize: 12, color: colors.slate, marginTop: 2 },

  gaugeCard: { paddingVertical: 26, alignItems: "center" },
  gaugeFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  progressCard: { padding: 18, gap: 16, overflow: "visible" },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  progressTitle: { fontSize: 16, fontWeight: "700", color: colors.charcoal },
  progressFoot: { fontSize: 12, color: colors.muted },

  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.charcoal },
  storeLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  storeLinkText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  carousel: { gap: 12, paddingVertical: 2 },
  brandCard: { width: 128 },
  brandInner: { padding: 16, alignItems: "center", gap: 8 },
  brandLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white },
  brandLogoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  brandName: { fontSize: 13, fontWeight: "600", color: colors.charcoal, width: 96, textAlign: "center" },
  brandCat: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
}));
