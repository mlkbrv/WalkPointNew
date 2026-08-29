/**
 * The illustrated empty state.
 *
 * Empty states were a grey outline glyph and a line of text, which reads as a
 * failure whether or not anything is wrong. These are drawn from the same
 * vocabulary as the app icon — round-capped strokes, brand purple, one idea per
 * picture — so an empty screen looks designed rather than broken.
 *
 * Vector, not bitmap, and drawn locally: they scale to any size, adapt to the
 * palette, and cost no network round trip on the screen least likely to have
 * finished loading.
 */

import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { radii, spacing } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { PressableScale } from "./PressableScale";


export type EmptyArt = "steps" | "wallet" | "inbox" | "store" | "board" | "offline";

function Art({ kind, size = 132 }: { kind: EmptyArt; size?: number }) {
  const { colors, isDark } = useTheme();
  const TINT = colors.primary;
  // A tint of the brand colour, lightened in dark mode so the disc reads as a
  // raised surface rather than a hole.
  const FAINT = isDark ? "rgba(169,124,255,0.14)" : "rgba(129,64,243,0.16)";
  const common = {
    stroke: TINT,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* A soft disc behind every illustration, so they share a silhouette. */}
      <Circle cx="60" cy="60" r="46" fill={FAINT} />

      {kind === "steps" ? (
        <>
          {/* Footfalls climbing away, growing as they go: a journey, not a scatter.
              A dashed path was tried first and read as random dots at this size. */}
          {[
            [38, 82, 4.5, 0.3],
            [49, 74, 5.5, 0.45],
            [60, 65, 6.5, 0.62],
            [71, 55, 7.5, 0.8],
            [83, 44, 9, 1],
          ].map(([cx, cy, r, opacity]) => (
            <Circle key={cx} cx={cx} cy={cy} r={r} fill={TINT} opacity={opacity} />
          ))}
        </>
      ) : null}

      {kind === "wallet" ? (
        <>
          <Rect x="34" y="46" width="52" height="36" rx="9" {...common} />
          <Path d="M34 58 H86" {...common} strokeWidth={4} />
          <Circle cx="74" cy="70" r="4.5" fill={TINT} />
        </>
      ) : null}

      {kind === "inbox" ? (
        <>
          <Path d="M34 52 L60 70 L86 52" {...common} />
          <Rect x="34" y="44" width="52" height="34" rx="8" {...common} />
        </>
      ) : null}

      {kind === "store" ? (
        <>
          <Path d="M36 54 H84 L80 84 H40 Z" {...common} />
          <Path d="M50 54 V46 a10 10 0 0 1 20 0 V54" {...common} />
        </>
      ) : null}

      {kind === "board" ? (
        <>
          {/* Three rising columns: the shape of a scoreboard. */}
          <Rect x="38" y="66" width="13" height="20" rx="5" fill={TINT} opacity={0.45} />
          <Rect x="54" y="48" width="13" height="38" rx="5" fill={TINT} />
          <Rect x="70" y="58" width="13" height="28" rx="5" fill={TINT} opacity={0.7} />
        </>
      ) : null}

      {kind === "offline" ? (
        <>
          <Path d="M40 72 a14 14 0 0 1 3 -27 a19 19 0 0 1 35 -6 a13 13 0 0 1 2 33 Z" {...common} />
          <Path d="M44 40 L82 82" {...common} stroke={colors.coralInk} strokeWidth={5} />
        </>
      ) : null}
    </Svg>
  );
}

export function EmptyState({
  art,
  title,
  body,
  actionLabel,
  onAction,
  children,
}: {
  art: EmptyArt;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <Art kind={art} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale style={styles.action} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  title: {
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: "800",
    color: colors.charcoal,
    textAlign: "center",
  },
  body: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate,
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    // Comfortably past the 44pt minimum touch target.
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  actionText: { color: colors.white, fontWeight: "800", fontSize: 13 },
}));
