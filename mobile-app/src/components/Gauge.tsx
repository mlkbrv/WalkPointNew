/**
 * The step gauge: a three-quarter arc with a tick scale and a button in the gap.
 *
 * Two decisions here are worth explaining, because the obvious versions of both
 * do not survive contact with the ticks.
 *
 * **Explicit arc paths, not a rotated dashed circle.** The ring this replaces
 * drew a full `<Circle>` and rotated the whole `<Svg>` by -90° with a React
 * Native style transform, because SVG's dash phase starts at 3 o'clock. That
 * works for a bare ring, but the moment ticks are added their angles have to be
 * computed in SVG coordinates while the arc's apparent start lives in the
 * rotated frame — two coordinate systems that drift apart. Here the arc and the
 * ticks are both generated from `START`/`sweepDeg`, so they line up structurally
 * rather than by coincidence, and nothing is rotated.
 *
 * **Progress is a dash mask over the full arc, not a shorter arc.** React
 * Native's `Animated` can only interpolate numbers, and `d` is a string — so an
 * arc that grows by regenerating its path cannot animate (and Reanimated, which
 * could drive it from a worklet, is not in this project: its CMake build hangs
 * on Windows). `strokeDashoffset` *is* a number, so the full arc is drawn once
 * and revealed by animating the dash. That also keeps the node identity stable
 * across renders instead of remounting a path on every step count.
 */

import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { makeStyles, useTheme } from "../contexts/ThemeContext";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * SVG angles: 0° is 3 o'clock and they increase clockwise, because y grows
 * downward. The bottom of the circle is therefore 90°, and a 270° sweep centred
 * on that gap runs 135° → 405°, leaving 45°..135° free for the button.
 */
const START = 135;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  // A true 360° arc degenerates: start and end are the same point, and the
  // renderer draws nothing at all rather than a full circle.
  const end = Math.min(to, from + 359.9);
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, end);
  const large = end - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

export function Gauge({
  value,
  goal,
  size = 232,
  strokeWidth = 14,
  sweepDeg = 270,
  ticks = 60,
  label = "Steps",
  children,
}: {
  value: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  sweepDeg?: number;
  /** Tick marks along the scale. 0 draws none. */
  ticks?: number;
  label?: string;
  /** Sits in the arc's bottom gap — the play/pause button in the reference. */
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2 - 2;
  const arcLength = 2 * Math.PI * r * (sweepDeg / 360);

  // A goal of 0 would divide by zero; an over-achieved goal should fill, not wrap.
  const ratio = goal > 0 ? Math.max(0, Math.min(value / goal, 1)) : 0;

  const dash = useRef(new Animated.Value(arcLength)).current;

  useEffect(() => {
    Animated.timing(dash, {
      toValue: arcLength * (1 - ratio),
      duration: 900,
      // strokeDashoffset is neither a transform nor an opacity, so it cannot be
      // driven natively. It is one property on one node, so that is acceptable.
      useNativeDriver: false,
    }).start();
  }, [dash, arcLength, ratio]);

  const track = arcPath(cx, cy, r, START, START + sweepDeg);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Path
          d={track}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {ticks > 0
          ? Array.from({ length: ticks }, (_, i) => {
              // Sharing START and sweepDeg with the arc is what guarantees the
              // first and last tick sit flush with the arc's own endpoints.
              const deg = START + (sweepDeg * i) / (ticks - 1);
              const outer = polar(cx, cy, r - strokeWidth / 2 - 5, deg);
              const inner = polar(cx, cy, r - strokeWidth / 2 - 11, deg);
              return (
                <Line
                  key={i}
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke={colors.border}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
              );
            })
          : null}

        <AnimatedPath
          d={track}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${arcLength} ${arcLength}`}
          strokeDashoffset={dash}
        />
      </Svg>

      {/* Real <Text>, not SVG text: glyph metrics differ between
          react-native-svg's native and web renderers, and this app ships both. */}
      <View style={styles.centre} pointerEvents="none">
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value.toLocaleString()}</Text>
        <Text style={styles.goal}>/{goal.toLocaleString()}</Text>
      </View>

      {children ? <View style={styles.slot}>{children}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { alignItems: "center", justifyContent: "center" },
  centre: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 40, fontWeight: "700", color: colors.charcoal, marginTop: 2 },
  goal: { fontSize: 13, color: colors.muted, marginTop: 2 },
  slot: { position: "absolute", bottom: 0, alignSelf: "center", zIndex: 1 },
}));
