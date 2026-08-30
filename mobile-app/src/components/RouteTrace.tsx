/**
 * Draws a recorded route.
 *
 * No basemap: this renders the shape of the walk on a plain surface. It
 * replaces a "map" that was three slanted rectangles and a purple glow —
 * identical for every user, everywhere on Earth — with the actual path.
 *
 * The projection is equirectangular about the route's own mean latitude, so a
 * kilometre north and a kilometre east are drawn the same length. Plotting raw
 * degrees would stretch the track horizontally by 1/cos(latitude): about 1.8x
 * at 56°N, enough to turn a square block into a rectangle.
 */

import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { Point } from "../utils/geo";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { radii } from "../theme";

export function RouteTrace({
  points,
  height = 220,
}: {
  points: Point[];
  height?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          {points.length === 0
            ? "No route recorded yet."
            : "Waiting for a second position…"}
        </Text>
      </View>
    );
  }

  const meanLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);

  const projected = points.map(([lng, lat]) => ({ x: lng * cosLat, y: -lat }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // A straight walk has zero extent on one axis; a floor keeps the scale finite.
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);

  const PAD = 16;
  const W = 320;
  const H = height;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);

  // Centred, so a short walk sits in the middle rather than in a corner.
  const offsetX = (W - spanX * scale) / 2;
  const offsetY = (H - spanY * scale) / 2;
  const place = (p: { x: number; y: number }) => [
    offsetX + (p.x - minX) * scale,
    offsetY + (p.y - minY) * scale,
  ];

  const d = projected
    .map((p, i) => {
      const [x, y] = place(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const [startX, startY] = place(projected[0]);
  const [endX, endY] = place(projected[projected.length - 1]);

  return (
    <View style={[styles.frame, { height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Path
          d={d}
          stroke={colors.primary}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={startX} cy={startY} r={6} fill={colors.card} stroke={colors.primary} strokeWidth={3} />
        <Circle cx={endX} cy={endY} r={6} fill={colors.primary} />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  frame: {
    borderRadius: radii.lg,
    backgroundColor: colors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  empty: {
    borderRadius: radii.lg,
    backgroundColor: colors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 15, color: colors.muted },
}));
