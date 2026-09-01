/**
 * The three-up metric row: time, calories, distance.
 *
 * It appears on Home, on Report and on the goal-reached screen, and it had been
 * hand-rolled on each — which is how one copy of it ended up rendering "kcal"
 * three times over a literal `[km|mins]` placeholder. One component, one
 * ordering, one set of colours.
 *
 * Callers pass a semantic `tone`, never a colour. In the reference these three
 * glyph colours are the *only* non-violet accents in the whole app, so letting
 * a screen choose its own would be how that discipline erodes.
 */

import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GlassCard } from "./GlassCard";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import type { Palette } from "../theme";

export type StatTone = "time" | "calories" | "distance";

export interface Stat {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  unit: string;
  tone: StatTone;
}

function inkFor(tone: StatTone, colors: Palette): string {
  if (tone === "time") return colors.amberInk;
  if (tone === "calories") return colors.coralInk;
  return colors.emeraldInk;
}

export function StatTileRow({ stats }: { stats: Stat[] }) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.row}>
      {stats.map((stat) => {
        const ink = inkFor(stat.tone, colors);
        return (
          <GlassCard key={stat.key} style={styles.tile}>
            <View style={[styles.icon, { backgroundColor: `${ink}1F` }]}>
              <Ionicons name={stat.icon} size={15} color={ink} />
            </View>
            <Text style={styles.value}>{stat.value}</Text>
            <Text style={styles.unit}>{stat.unit}</Text>
          </GlassCard>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, paddingVertical: 14, alignItems: "center", gap: 6 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 17, fontWeight: "700", color: colors.charcoal },
  unit: { fontSize: 12, color: colors.muted },
}));
