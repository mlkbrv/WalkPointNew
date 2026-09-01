/**
 * The statistics bar chart: a labelled y-axis, selectable columns, and a
 * tooltip pinned above the selected one.
 *
 * This replaces two divergent inline charts that had grown separately — one
 * sizing its bars as a percentage of a card that had to keep a fixed height for
 * the percentages to mean anything, the other in pixels against a hardcoded
 * 15,000-step ceiling that silently clipped anyone who walked more. Here the
 * scale is derived from the data and the bars are laid out in pixels off a
 * known plot height, so neither failure mode is reachable.
 *
 * Plain views rather than SVG: the shapes are rectangles, and staying out of
 * SVG keeps text metrics identical between native and the web build.
 */

import { Text, View } from "react-native";

import { PressableScale } from "./PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export interface Bar {
  key: string;
  label: string;
  value: number;
}

/**
 * Rounds the axis ceiling up so every gridline lands on a round number.
 * Without this a max of 6,431 over 7 ticks labels the axis 919, 1838, 2757 …
 */
function niceCeiling(max: number, ticks: number): number {
  if (max <= 0) return ticks;
  const rough = max / ticks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  return step * ticks;
}

function defaultFormatY(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(Math.round(n));
}

export function BarChart({
  data,
  height = 168,
  selectedKey,
  onSelect,
  yTicks = 5,
  formatY = defaultFormatY,
  formatTooltip,
}: {
  data: Bar[];
  /** Height of the plot area alone; the x-axis labels sit below it. */
  height?: number;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  yTicks?: number;
  formatY?: (n: number) => string;
  formatTooltip?: (bar: Bar) => string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const ceiling = niceCeiling(max, yTicks);

  // Top tick first, so the column reads down the axis the way it is drawn.
  const ticks = Array.from({ length: yTicks }, (_, i) => (ceiling * (yTicks - i)) / yTicks);

  return (
    <View style={styles.root}>
      <View style={[styles.axis, { height }]}>
        {ticks.map((t) => (
          <Text key={t} style={styles.axisLabel}>
            {formatY(t)}
          </Text>
        ))}
      </View>

      <View style={styles.plotColumn}>
        <View style={[styles.plot, { height }]}>
          {data.map((bar) => {
            const selected = bar.key === selectedKey;
            // A real but tiny value must still be visible, so it floors at 3px —
            // but a genuine zero stays zero rather than showing a phantom bar.
            const barHeight =
              bar.value <= 0 ? 0 : Math.max(3, (bar.value / ceiling) * height);
            return (
              <PressableScale
                key={bar.key}
                haptic={false}
                style={styles.col}
                onPress={onSelect ? () => onSelect(bar.key) : undefined}
              >
                {selected && bar.value > 0 ? (
                  <View style={[styles.tooltipWrap, { bottom: barHeight + 8 }]}>
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipText}>
                        {formatTooltip ? formatTooltip(bar) : bar.value.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: selected ? colors.primary : `${colors.primary}59`,
                    },
                  ]}
                />
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.labels}>
          {data.map((bar) => (
            <View key={bar.key} style={styles.labelCol}>
              <Text
                style={[styles.label, bar.key === selectedKey && styles.labelActive]}
                numberOfLines={1}
              >
                {bar.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flexDirection: "row", gap: 8 },
  axis: { width: 30, justifyContent: "space-between", alignItems: "flex-end" },
  axisLabel: { fontSize: 10, color: colors.muted },

  plotColumn: { flex: 1 },
  // Bars grow from the baseline, so the row is bottom-aligned and must not clip
  // the tooltip that overhangs the tallest one.
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 6, overflow: "visible" },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", overflow: "visible" },
  bar: { width: "100%", borderRadius: 6 },

  // Stretched past the column on both sides so a wide value is not clipped by a
  // narrow bar; the parent chain is overflow-visible for the same reason.
  tooltipWrap: { position: "absolute", left: -30, right: -30, alignItems: "center", zIndex: 5 },
  tooltip: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tooltipText: { color: colors.onPrimary, fontSize: 11, fontWeight: "700" },

  labels: { flexDirection: "row", gap: 6, marginTop: 8 },
  labelCol: { flex: 1, alignItems: "center" },
  label: { fontSize: 11, color: colors.muted },
  labelActive: { color: colors.primary, fontWeight: "700" },
}));
