/**
 * A month grid marking the days that had activity.
 *
 * Every date here is handled in local time. The obvious `toISOString().slice(0,10)`
 * is UTC, so for anyone west of Greenwich it labels the wrong cell "today" for
 * part of every evening — visible immediately on a calendar in a way it never
 * was on a bar chart.
 *
 * Weeks start on Sunday to match the reference's Sun..Sat header.
 */

import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PressableScale } from "./PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { localDateKey } from "../health/dates";

export function MonthCalendar({
  month,
  onMonthChange,
  activeDates,
  onSelectDate,
}: {
  /** Any date inside the month to display. */
  month: Date;
  onMonthChange: (next: Date) => void;
  /** `YYYY-MM-DD` keys, local, for days with recorded activity. */
  activeDates: Set<string>;
  onSelectDate?: (iso: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { language } = useI18n();
  // Built from the selected language, not a hardcoded list, so the header
  // matches the month name rendered right above it.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 8, 1 + i).toLocaleDateString(language, { weekday: "short" }),
  );

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const today = localDateKey(new Date());

  const first = new Date(year, monthIndex, 1);
  const leading = first.getDay();

  // Six rows always, so the card does not change height between months.
  const cells = Array.from({ length: 42 }, (_, i) => {
    // `new Date(y, m, n)` normalises out-of-range days, which is what fills the
    // leading and trailing slots with the neighbouring months for free — and it
    // rolls the year correctly at both ends without a special case.
    const date = new Date(year, monthIndex, i - leading + 1);
    return {
      iso: localDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    };
  });

  const title = first.toLocaleDateString(language, { month: "long", year: "numeric" });

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <PressableScale
          style={styles.nav}
          onPress={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
        >
          <Ionicons name="chevron-back" size={16} color={colors.slate} />
        </PressableScale>
        <Text style={styles.title}>{title}</Text>
        <PressableScale
          style={styles.nav}
          onPress={() => onMonthChange(new Date(year, monthIndex + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.slate} />
        </PressableScale>
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((w) => (
          <View key={w} style={styles.cell}>
            <Text style={styles.weekday}>{w}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, i) => {
          const isToday = cell.iso === today;
          const active = cell.inMonth && activeDates.has(cell.iso);
          return (
            <View key={`${cell.iso}-${i}`} style={styles.cell}>
              <PressableScale
                haptic={false}
                style={[
                  styles.day,
                  isToday
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : active
                      ? { borderColor: colors.primary }
                      : undefined,
                ]}
                onPress={onSelectDate && cell.inMonth ? () => onSelectDate(cell.iso) : undefined}
              >
                <Text
                  style={[
                    styles.dayText,
                    !cell.inMonth && styles.dayOut,
                    isToday && { color: colors.onPrimary, fontWeight: "700" },
                    !isToday && active && { color: colors.primary, fontWeight: "600" },
                  ]}
                >
                  {cell.day}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.charcoal },

  weekRow: { flexDirection: "row" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  // Seven per row. A fraction rather than flex:1, because wrapped rows cannot
  // share a flex basis across the wrap.
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
  weekday: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  day: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 12, color: colors.charcoal },
  dayOut: { color: colors.muted, opacity: 0.4 },
}));
