import React, { useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
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
import type { ApiNotification } from "../api/endpoints";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function InboxScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    inbox,
    unreadCount,
    refreshInbox,
    markNotificationRead,
    markAllNotificationsRead,
  } = useServerData();

  // Notifications arrive while the app is elsewhere, so re-read on focus.
  useFocusEffect(
    useCallback(() => {
      void refreshInbox();
    }, [refreshInbox]),
  );

  const notifications = inbox.data;
  const coldLoading = inbox.loading && !inbox.loaded;

  const withinLastDay = (iso: string) => Date.now() - new Date(iso).getTime() < 86_400_000;
  const today = notifications.filter((n) => withinLastDay(n.created_at));
  const earlier = notifications.filter((n) => !withinLastDay(n.created_at));

  const relativeTime = (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  const categoryIcon = (type: string) => {
    if (type === "steps_missed")
      return { name: "warning" as const, bg: "rgba(255,107,82,0.12)", color: colors.coralInk };
    if (type === "coins_awarded")
      return { name: "sparkles" as const, bg: "rgba(0,225,148,0.12)", color: colors.emeraldInk };
    if (type === "new_coupon" || type === "moderation_result")
      return { name: "bag-handle" as const, bg: "rgba(129,64,243,0.12)", color: colors.primary };
    if (type === "support_reply")
      return { name: "chatbubbles" as const, bg: "rgba(129,64,243,0.12)", color: colors.primary };
    return { name: "trophy" as const, bg: colors.border, color: colors.slate };
  };

  const onPressNotif = async (notif: ApiNotification) => {
    if (!notif.is_read) void markNotificationRead(notif.id);

    // The server puts the target's id in `data`; that is what makes a tap useful.
    if (notif.notification_type === "support_reply") {
      navigation.navigate("SupportChat");
      return;
    }
    if (typeof notif.data?.coupon_id === "string") {
      navigation.navigate("Wallet");
    }
  };

  const renderItem = (notif: ApiNotification) => {
    const icon = categoryIcon(notif.notification_type);
    return (
      <PressableScale key={notif.id} onPress={() => onPressNotif(notif)}>
        <GlassCard style={notif.is_read ? styles.card : [styles.card, styles.cardUnread]}>
          {!notif.is_read ? <View style={styles.unreadBar} /> : null}
          <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={16} color={icon.color} />
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, notif.is_read && styles.titleRead]} numberOfLines={2}>
                {notif.title}
              </Text>
              <Text style={styles.time}>{relativeTime(notif.created_at)}</Text>
            </View>
            <Text style={styles.copy}>{notif.body}</Text>
          </View>
        </GlassCard>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Inbox Notifications</Text>
            <Text style={styles.sub}>
              {unreadCount > 0 ? `${unreadCount} unread actions` : "All caught up!"}
            </Text>
          </View>
          {unreadCount > 0 ? (
            <PressableScale style={styles.clearBtn} onPress={() => void markAllNotificationsRead()}>
              <Text style={styles.clearText}>Clear all</Text>
            </PressableScale>
          ) : null}
        </View>

        {today.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Today</Text>
            <View style={styles.list}>{today.map(renderItem)}</View>
          </View>
        ) : null}

        {earlier.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Earlier</Text>
            <View style={styles.list}>{earlier.map(renderItem)}</View>
          </View>
        ) : null}

        {coldLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : inbox.error && notifications.length === 0 ? (
          <EmptyState
            art="offline"
            title="Could not load your inbox"
            body={inbox.error ?? undefined}
            actionLabel="Try again"
            onAction={() => void refreshInbox()}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            art="inbox"
            title="Nothing here yet"
            body="Coins you earn and news from partners will land here."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  loading: { paddingVertical: 48, alignItems: "center" },
  retry: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontWeight: "400", fontSize: 15 },
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  heading: { fontSize: 22, fontWeight: "600", color: colors.charcoal },
  sub: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: "rgba(129,64,243,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  clearText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  list: { gap: 10 },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    overflow: "hidden",
    opacity: 0.85,
  },
  cardUnread: { opacity: 1, borderColor: "rgba(129,64,243,0.25)" },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.primary,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.charcoal, lineHeight: 16 },
  titleRead: { fontWeight: "400", color: colors.slate },
  time: { fontSize: 11, color: colors.muted, fontWeight: "400" },
  copy: { fontSize: 13, color: colors.slate, lineHeight: 16 },
  actionBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  summaryBtn: {
    backgroundColor: "rgba(129,64,243,0.1)",
  },
  actionText: { color: colors.white, fontSize: 12, fontWeight: "600", letterSpacing: 0.8 },
  codeBox: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600",
    color: colors.charcoal,
  },
  empty: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 15, fontWeight: "400", color: colors.muted },
}));
