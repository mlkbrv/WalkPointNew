/**
 * The week strip: seven day circles, ringed when the day had activity and
 * filled on today.
 *
 * The slots are built from a **date range**, not from the rows the server sent.
 * `useStepHistory` filters its window with a strict `>` against a date string,
 * so it returns seven or eight entries depending on the hour, and it returns
 * nothing at all for a day the device never synced. Mapping over that array —
 * which is what the bar strip this replaces did — silently renders eight
 * columns some evenings, and shifts every weekday label by one whenever a day
 * is missing. Iterating dates and looking each one up cannot do either.
 */

import { Text, View } from "react-native";

import { PressableScale } from "./PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { localDateKey } from "../health/dates";

export function DayCircleRow({
  days,
  goal,
  weeksAgo = 0,
  onSelect,
}: {
  days: { date: string; steps: number }[];
  goal: number;
  /** 0 renders the week ending today; 1 the seven days before that. */
  weeksAgo?: number;
  onSelect?: (iso: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t, language } = useI18n();

  const stepsByDate = new Map(days.map((d) => [d.date, d.steps]));
  const today = localDateKey(new Date());

  // Seven slots ending on the last day of the requested week, oldest first.
  const slots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - weeksAgo * 7 - (6 - i));
    d.setHours(0, 0, 0, 0);
    const iso = localDateKey(d);
    return {
      iso,
      dayOfMonth: d.getDate(),
      weekday: d.toLocaleDateString(language, { weekday: "short" }),
      steps: stepsByDate.get(iso) ?? 0,
      isToday: iso === today,
    };
  });

  return (
    <View style={styles.row}>
      {slots.map((slot) => {
        const reached = goal > 0 && slot.steps >= goal;
        const active = slot.steps > 0;
        return (
          <PressableScale
            key={slot.iso}
            haptic={false}
            style={styles.col}
            onPress={onSelect ? () => onSelect(slot.iso) : undefined}
          >
            <View
              style={[
                styles.circle,
                slot.isToday
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : reached
                    ? { backgroundColor: colors.primaryTint, borderColor: colors.primary }
                    : active
                      ? { borderColor: colors.primary }
                      : { borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.day,
                  slot.isToday
                    ? { color: colors.onPrimary }
                    : active
                      ? { color: colors.primary }
                      : { color: colors.muted },
                ]}
              >
                {slot.dayOfMonth}
              </Text>
            </View>
            <Text style={[styles.weekday, slot.isToday && { color: colors.primary }]}>
              {slot.isToday ? t("today") : slot.weekday}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", justifyContent: "space-between" },
  col: { alignItems: "center", gap: 6 },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { fontSize: 13, fontWeight: "600" },
  weekday: { fontSize: 11, color: colors.muted },
}));
