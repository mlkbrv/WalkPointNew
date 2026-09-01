/**
 * The six-step intake from the reference: gender, lifestyle, age, height,
 * weight, step goal.
 *
 * One screen with a step index rather than six routes in a stack. The steps
 * share a frame (progress bar, title, Skip/Continue) and differ only in the
 * control between them, so six navigator entries would be six copies of the
 * chrome and a param list threading half-collected answers between them.
 *
 * Answers land in `useStride().userStats`, which is device-local and already
 * persisted — the server has no column for height, weight or gender. Skipping
 * a step is allowed and simply leaves that field at its default; only the goal
 * meaningfully changes the app, and it has a sensible one.
 *
 * Height and weight are always stored metric. The unit toggle changes the
 * numbers on the wheel and converts on the way in, so switching to feet and
 * back cannot drift the stored value.
 */

import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "../components/PillButton";
import { PressableScale } from "../components/PressableScale";
import { SegmentedChips } from "../components/SegmentedChips";
import { WheelPicker } from "../components/WheelPicker";
import { useStride } from "../contexts/StrideContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import type { Gender } from "../types";

const STEPS = 6;

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const CM = range(120, 220);
const FT_IN = range(48, 86).map((inches) => `${Math.floor(inches / 12)}'${inches % 12}"`);
const KG = range(35, 180);
const LB = range(77, 397);
const AGE = range(12, 99);
const GOAL = range(2000, 20000, 500);

const cmToInches = (cm: number) => Math.round(cm / 2.54);
const inchesToCm = (inches: number) => Math.round(inches * 2.54);
const kgToLb = (kg: number) => Math.round(kg * 2.20462);
const lbToKg = (lb: number) => Math.round(lb / 2.20462);

/** Renders a title with one word picked out in the accent colour. */
function Title({ text, accent }: { text: string; accent: string }) {
  const styles = useStyles();
  const [before, after] = text.split("{}");
  return (
    <Text style={styles.title}>
      {before}
      <Text style={styles.titleAccent}>{accent}</Text>
      {after}
    </Text>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { userStats, setUserStats } = useStride();

  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<"cm" | "ft">("cm");
  const [mass, setMass] = useState<"kg" | "lbs">("kg");

  const next = () => (step + 1 >= STEPS ? onDone() : setStep(step + 1));
  const back = () => (step === 0 ? undefined : setStep(step - 1));

  const set = <K extends keyof typeof userStats>(key: K, value: (typeof userStats)[K]) =>
    setUserStats((prev) => ({ ...prev, [key]: value }));

  const heightValues = units === "cm" ? CM : FT_IN;
  const heightValue =
    units === "cm"
      ? userStats.heightCm
      : FT_IN[Math.max(0, cmToInches(userStats.heightCm) - 48)] ?? FT_IN[0];

  const massValues = mass === "kg" ? KG : LB;
  const massValue = mass === "kg" ? userStats.weightKg : kgToLb(userStats.weightKg);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.head}>
        <PressableScale
          style={[styles.back, step === 0 && styles.backHidden]}
          disabled={step === 0}
          onPress={back}
        >
          <Ionicons name="arrow-back" size={19} color={colors.charcoal} />
        </PressableScale>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS) * 100}%` }]} />
        </View>
        <Text style={styles.counter}>
          {step + 1} / {STEPS}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <>
            <Title text="Select Your {}" accent="Gender" />
            <Text style={styles.subtitle}>Let&apos;s start by understanding you.</Text>
            <View style={styles.genderRow}>
              {(
                [
                  { key: "man", label: "Man", icon: "man" },
                  { key: "woman", label: "Woman", icon: "woman" },
                ] as const
              ).map((option) => {
                const active = userStats.gender === option.key;
                return (
                  <View key={option.key} style={styles.genderSlot}>
                    <PressableScale
                      style={[styles.genderCard, active && styles.genderCardActive]}
                      onPress={() => set("gender", option.key as Gender)}
                    >
                      <View style={[styles.genderIcon, active && styles.genderIconActive]}>
                        <Ionicons
                          name={option.icon}
                          size={48}
                          color={active ? colors.onPrimary : colors.slate}
                        />
                      </View>
                      <Text style={[styles.genderLabel, active && styles.genderLabelActive]}>
                        {option.label}
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Title text="Do You Live a {} Lifestyle?" accent="Sedentary" />
            <Text style={styles.subtitle}>Tell us about your daily routine.</Text>
            <View style={styles.yesNoRow}>
              {(
                [
                  { key: false, label: "No" },
                  { key: true, label: "Yes" },
                ] as const
              ).map((option) => {
                const active = userStats.sedentary === option.key;
                return (
                  <PressableScale
                    key={option.label}
                    style={[styles.yesNo, active && styles.yesNoActive]}
                    onPress={() => set("sedentary", option.key)}
                  >
                    <Text style={[styles.yesNoText, active && styles.yesNoTextActive]}>
                      {option.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Title text="How {} Are You?" accent="Old" />
            <Text style={styles.subtitle}>Share your age with us.</Text>
            <WheelPicker
              values={AGE}
              value={userStats.ageYears}
              unit="years"
              onChange={(v) => set("ageYears", Number(v))}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Title text="What&apos;s Your {}?" accent="Height" />
            <Text style={styles.subtitle}>How tall are you?</Text>
            <View style={styles.unitRow}>
              <SegmentedChips
                options={["cm", "ft"] as const}
                value={units}
                onChange={setUnits}
                variant="segmented"
              />
            </View>
            <WheelPicker
              values={heightValues}
              value={heightValue}
              unit={units === "cm" ? "cm" : undefined}
              onChange={(v) => {
                if (units === "cm") set("heightCm", Number(v));
                else set("heightCm", inchesToCm(FT_IN.indexOf(String(v)) + 48));
              }}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Title text="What&apos;s Your {}?" accent="Weight" />
            <Text style={styles.subtitle}>Share your weight with us.</Text>
            <View style={styles.unitRow}>
              <SegmentedChips
                options={["kg", "lbs"] as const}
                value={mass}
                onChange={setMass}
                variant="segmented"
              />
            </View>
            <WheelPicker
              values={massValues}
              value={massValue}
              unit={mass}
              onChange={(v) =>
                set("weightKg", mass === "kg" ? Number(v) : lbToKg(Number(v)))
              }
            />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Title text="Set Your {}" accent="Step Goal" />
            <Text style={styles.subtitle}>Choose your daily step goal to stay motivated!</Text>
            <WheelPicker
              values={GOAL}
              value={userStats.stepsGoal}
              unit="steps"
              onChange={(v) => set("stepsGoal", Number(v))}
            />
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PillButton label="Skip" variant="soft" flex onPress={next} />
        <PillButton label={step === STEPS - 1 ? "Finish" : "Continue"} flex onPress={next} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.card },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20 },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backHidden: { opacity: 0 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  counter: { fontSize: 13, fontWeight: "600", color: colors.slate, minWidth: 40 },

  body: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 8 },
  title: { fontSize: 26, fontWeight: "700", color: colors.charcoal, textAlign: "center" },
  titleAccent: { color: colors.primary },
  subtitle: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 24 },

  genderRow: { flexDirection: "row", gap: 14 },
  genderSlot: { flex: 1 },
  genderCard: {
    paddingVertical: 26,
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  genderCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  genderIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inputSurface,
  },
  genderIconActive: { backgroundColor: colors.primary },
  genderLabel: { fontSize: 15, fontWeight: "600", color: colors.slate },
  genderLabelActive: { color: colors.primary },

  yesNoRow: { flexDirection: "row", gap: 20, justifyContent: "center", marginTop: 12 },
  yesNo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  yesNoActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  yesNoText: { fontSize: 17, fontWeight: "700", color: colors.slate },
  yesNoTextActive: { color: colors.onPrimary },

  unitRow: { alignItems: "center", marginBottom: 20 },

  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
}));
