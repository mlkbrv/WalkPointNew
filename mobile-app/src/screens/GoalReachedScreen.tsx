/**
 * The goal-reached celebration.
 *
 * This replaces `WorkoutSummaryScreen`, which was registered in the navigator
 * but which nothing ever navigated to — a dead route whose entire palette was
 * hardcoded. Its useful half (read the day back from the server, show real
 * totals) survives here; the half that described a "workout" does not, because
 * sessions stopped being the unit of progress when tracking became passive.
 *
 * The confetti is laid out from a fixed table rather than `Math.random()`. A
 * random scatter is regenerated on every render, so the pieces jump whenever
 * anything above them changes.
 */

import { ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "../components/PillButton";
import { StatTileRow, type Stat } from "../components/StatTileRow";
import { useStride } from "../contexts/StrideContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { caloriesFromSteps, distanceFromSteps, minutesFromSteps } from "../utils/metrics";

/** left %, top %, rotation, size, tone index — fixed so the scatter is stable. */
const CONFETTI: [number, number, number, number, number][] = [
  [8, 6, 24, 10, 0], [22, 14, -18, 7, 1], [37, 4, 42, 9, 2], [52, 12, -32, 8, 3],
  [68, 5, 16, 11, 0], [84, 13, -44, 7, 1], [14, 24, 38, 8, 2], [31, 30, -12, 10, 3],
  [46, 22, 52, 7, 0], [62, 29, -28, 9, 1], [78, 21, 34, 8, 2], [91, 27, -16, 7, 3],
  [5, 38, 18, 9, 1], [26, 44, -36, 7, 0], [44, 40, 28, 10, 3], [59, 46, -22, 8, 2],
  [73, 38, 46, 7, 1], [88, 44, -30, 9, 0],
];

export function GoalReachedScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{
    goBack: () => void;
    navigate: (s: string, p?: object) => void;
  }>();
  const { userStats } = useStride();

  const steps = userStats.stepsToday;
  const tones = [colors.primary, colors.coral, colors.amber, colors.emerald];

  const stats: Stat[] = [
    {
      key: "time",
      icon: "time-outline",
      value: `${minutesFromSteps(steps)}m`,
      unit: t("time"),
      tone: "time",
    },
    {
      key: "calories",
      icon: "flame",
      value: String(caloriesFromSteps(steps)),
      unit: t("kcal"),
      tone: "calories",
    },
    {
      key: "distance",
      icon: "location",
      value: distanceFromSteps(steps).toFixed(2),
      unit: t("km"),
      tone: "distance",
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.confetti} pointerEvents="none">
        {CONFETTI.map(([left, top, rotate, size, tone], i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size * 0.5,
              borderRadius: 2,
              backgroundColor: tones[tone],
              transform: [{ rotate: `${rotate}deg` }],
              opacity: 0.85,
            }}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={72} color={colors.amber} />
        </View>

        <Text style={styles.title}>{t("stepsExclaim", { steps: steps.toLocaleString() })}</Text>
        <Text style={styles.body}>
          {t("goalReachedBody", { goal: userStats.stepsGoal.toLocaleString() })}
        </Text>

        <View style={styles.stats}>
          <StatTileRow stats={stats} />
        </View>

        <View style={styles.actions}>
          <PillButton label={t("notNow")} variant="soft" flex onPress={() => navigation.goBack()} />
          <PillButton
            label={t("seeReport")}
            flex
            onPress={() => navigation.navigate("Main", { screen: "ReportTab" })}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  confetti: { position: "absolute", top: 0, left: 0, right: 0, height: "55%" },
  scroll: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, alignItems: "center" },
  trophy: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: { fontSize: 30, fontWeight: "700", color: colors.charcoal, textAlign: "center" },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.slate,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
  stats: { alignSelf: "stretch", marginTop: 28 },
  actions: { flexDirection: "row", gap: 12, alignSelf: "stretch", marginTop: 28 },
}));
