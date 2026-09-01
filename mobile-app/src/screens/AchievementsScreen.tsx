/**
 * Levels earned by walking.
 *
 * The thresholds are counted against the last 365 days, not all time: the step
 * history endpoint caps `days` at 365, so a true lifetime figure is not
 * available from the API. The copy says "in the last year" rather than
 * implying a total the server was never asked for.
 *
 * Levels are derived, never stored. There is no achievements table on the
 * server, so persisting a level here would be a second source of truth that
 * could disagree with the step rows it was supposed to summarise.
 */

import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "../api/client";
import { stepsApi } from "../api/endpoints";
import { EmptyState } from "../components/EmptyState";
import { PressableScale } from "../components/PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

/** Fifteen rungs, matching the reference's grid. */
const THRESHOLDS = [
  10_000, 25_000, 50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000,
  750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
];

const MAX_DAYS = 365;

function short(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  return `${n / 1000}k`;
}

export function AchievementsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ goBack: () => void }>();

  const [steps, setSteps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await stepsApi.history(MAX_DAYS);
      setSteps(page.total_steps);
    } catch (caught) {
      setError(describeError(caught));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = steps ?? 0;
  // The number of thresholds passed; 0 means no level reached yet.
  const level = THRESHOLDS.filter((t) => total >= t).length;
  const nextThreshold = THRESHOLDS[level];

  if (steps === null && !error) {
    return (
      <View style={[styles.root, styles.centred]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.primary, colors.onPrimarySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.heroBar}>
            <PressableScale style={styles.back} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={colors.white} />
            </PressableScale>
            <Text style={styles.heroTitle}>Achievements</Text>
            <View style={styles.back} />
          </View>

          <View style={styles.medal}>
            <Ionicons name="trophy" size={56} color="#FBBF24" />
          </View>
          <Text style={styles.heroLevel}>{level === 0 ? "No level yet" : `Level ${level}`}</Text>
          <Text style={styles.heroCopy}>
            {level === 0
              ? `Walk ${short(THRESHOLDS[0])} steps to reach your first level`
              : `You've passed ${short(THRESHOLDS[level - 1])} steps in the last year`}
          </Text>
          {nextThreshold ? (
            <Text style={styles.heroNext}>
              {(nextThreshold - total).toLocaleString()} steps to level {level + 1}
            </Text>
          ) : (
            <Text style={styles.heroNext}>Every level cleared</Text>
          )}
        </LinearGradient>

        <View style={styles.sheet}>
          {error ? (
            <EmptyState
              art="offline"
              title="Could not load your levels"
              body={error}
              actionLabel="Try again"
              onAction={() => void load()}
            />
          ) : (
            <View style={styles.grid}>
              {THRESHOLDS.map((threshold, i) => {
                const earned = total >= threshold;
                return (
                  <View key={threshold} style={styles.slot}>
                    <View style={[styles.badge, earned && styles.badgeEarned]}>
                      <Ionicons
                        name={earned ? "medal" : "lock-closed"}
                        size={earned ? 28 : 20}
                        color={earned ? colors.primary : colors.muted}
                      />
                    </View>
                    <Text style={[styles.badgeLevel, earned && styles.badgeLevelEarned]}>
                      Level {i + 1}
                    </Text>
                    <Text style={styles.badgeHint} numberOfLines={1}>
                      {earned ? "Passed" : `${short(threshold)} steps`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  centred: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },

  hero: { paddingHorizontal: 20, paddingBottom: 32, alignItems: "center", gap: 6 },
  heroBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginBottom: 18,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 17, fontWeight: "700", color: colors.white },
  medal: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroLevel: { fontSize: 24, fontWeight: "700", color: colors.white },
  heroCopy: { fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  heroNext: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 },

  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // A third each, so three sit per row across every phone width.
  slot: { width: `${100 / 3}%`, alignItems: "center", gap: 4, paddingVertical: 14 },
  badge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inputSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeEarned: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  badgeLevel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 4 },
  badgeLevelEarned: { color: colors.charcoal },
  badgeHint: { fontSize: 10, color: colors.muted },
}));
