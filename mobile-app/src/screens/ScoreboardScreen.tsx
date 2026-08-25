import React from "react";
import {
  Image,
  ImageStyle,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme";
import { GlassCard } from "../components/GlassCard";
import { useStride } from "../contexts/StrideContext";

export function ScoreboardScreen() {
  const insets = useSafeAreaInsets();
  const { leaderboard } = useStride();
  const sorted = [...leaderboard].sort((a, b) => b.steps - a.steps);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const top3 = sorted[2];

  const renderPodiumPerson = (
    user: typeof top1 | undefined,
    place: 1 | 2 | 3
  ) => {
    if (!user) return <View style={styles.podiumSlot} />;
    const size = place === 1 ? 72 : 56;
    const ring =
      place === 1 ? "#FACC15" : place === 2 ? "#CBD5E1" : "#FB923C";
    const badgeBg =
      place === 1 ? "#FACC15" : place === 2 ? "#94A3B8" : "#FB923C";
    const avatarStyle: ImageStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: place === 1 ? 4 : 2,
      borderColor: ring,
    };
    return (
      <View style={[styles.podiumSlot, place === 1 && styles.podiumFirst]}>
        <View style={styles.avatarRel}>
          <Image source={{ uri: user.avatar }} style={avatarStyle} />
          <View style={[styles.placeBadge, { backgroundColor: badgeBg }]}>
            <Text style={styles.placeText}>{place === 1 ? "1" : String(place)}</Text>
          </View>
        </View>
        <Text style={[styles.podiumName, place === 1 && styles.podiumNameFirst]} numberOfLines={1}>
          {user.name.split(" ")[0]}
        </Text>
        <Text style={styles.podiumSteps}>{(user.steps / 1000).toFixed(1)}k</Text>
        <Text style={styles.podiumLabel}>Steps</Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Global Scoreboard</Text>
            <Text style={styles.sub}>Stride Masters Guild</Text>
          </View>
          <View style={styles.season}>
            <Ionicons name="trophy" size={12} color={colors.primary} />
            <Text style={styles.seasonText}>SEASON 4</Text>
          </View>
        </View>

        <GlassCard style={styles.podium}>
          {renderPodiumPerson(top2, 2)}
          {renderPodiumPerson(top1, 1)}
          {renderPodiumPerson(top3, 3)}
        </GlassCard>

        <Text style={styles.listLabel}>Current Rankings</Text>
        <View style={styles.list}>
          {sorted.map((user, index) => {
            const rank = index + 1;
            const isSelf = !!user.isSelf;
            const rankColor =
              rank === 1 ? "#EAB308" : rank === 2 ? colors.muted : rank === 3 ? "#F97316" : colors.muted;
            return (
              <View
                key={`${user.rank}-${user.name}`}
                style={[styles.row, isSelf && styles.rowSelf]}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rank, { color: rankColor }]}>{rank}</Text>
                  <View style={styles.avatarRel}>
                    <Image source={{ uri: user.avatar }} style={styles.listAvatar as ImageStyle} />
                    {isSelf ? <View style={styles.selfDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, isSelf && styles.nameSelf]} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <Text style={styles.status}>{user.statusText || "On a streak!"}</Text>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.steps}>{user.steps.toLocaleString()}</Text>
                  <Text style={styles.stepsLabel}>Steps</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 120, gap: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.charcoal },
  sub: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  season: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(129,64,243,0.1)",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.2)",
  },
  seasonText: { fontSize: 10, fontWeight: "900", color: colors.primary },
  podium: {
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 210,
  },
  podiumSlot: { flex: 1, alignItems: "center", gap: 4 },
  podiumFirst: { transform: [{ translateY: -14 }, { scale: 1.08 }] },
  avatarRel: { position: "relative", marginBottom: 6 },
  placeBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  placeText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  podiumName: { fontSize: 12, fontWeight: "700", color: colors.charcoal, maxWidth: 80, textAlign: "center" },
  podiumNameFirst: { fontSize: 14, fontWeight: "900" },
  podiumSteps: { fontSize: 12, fontWeight: "900", color: colors.primary },
  podiumLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  listLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelf: {
    backgroundColor: "rgba(129,64,243,0.06)",
    borderColor: "rgba(129,64,243,0.4)",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rank: { width: 24, textAlign: "center", fontSize: 14, fontWeight: "900" },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selfDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.emerald,
    borderWidth: 1,
    borderColor: colors.white,
  },
  name: { fontSize: 12, fontWeight: "700", color: colors.charcoal },
  nameSelf: { color: colors.primary, fontWeight: "900" },
  status: { fontSize: 10, color: colors.muted, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  steps: { fontSize: 14, fontWeight: "900", color: colors.charcoal },
  stepsLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
