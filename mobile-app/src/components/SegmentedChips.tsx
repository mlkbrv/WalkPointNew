/**
 * A row of mutually exclusive options.
 *
 * Two shapes, because the reference uses two: `pill` is the free-floating
 * filter row under the chart (Steps / Time / Calorie / Distance), `segmented`
 * is the enclosed two-up track used for units (cm / ft, kg / lbs).
 */

import { Text, View } from "react-native";

import { PressableScale } from "./PressableScale";
import { makeStyles } from "../contexts/ThemeContext";

export function SegmentedChips<T extends string>({
  options,
  value,
  onChange,
  variant = "pill",
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  variant?: "pill" | "segmented";
}) {
  const styles = useStyles();
  const enclosed = variant === "segmented";

  return (
    <View style={enclosed ? styles.track : styles.row}>
      {options.map((option) => {
        const active = option === value;
        return (
          // The percentage/flex sizing lives on this View, never on
          // PressableScale — it puts the caller's style on its inner Pressable
          // and leaves the wrapper unsized, so a flex child would collapse.
          <View key={option} style={enclosed ? styles.segmentSlot : undefined}>
            <PressableScale
              style={[
                enclosed ? styles.segment : styles.chip,
                active && (enclosed ? styles.segmentActive : styles.chipActive),
              ]}
              onPress={() => onChange(option)}
            >
              <Text
                style={[
                  styles.text,
                  active && (enclosed ? styles.textOnSegment : styles.textOnChip),
                ]}
              >
                {option}
              </Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.inputSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentSlot: {},
  segment: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.primary },

  text: { fontSize: 13, fontWeight: "600", color: colors.slate },
  textOnChip: { color: colors.onPrimary },
  textOnSegment: { color: colors.onPrimary },
}));
