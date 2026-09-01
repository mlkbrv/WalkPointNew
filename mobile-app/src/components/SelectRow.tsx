/**
 * A settings row that opens a list of choices, as the reference's Preferences
 * screen does: label on the left, current value and a chevron on the right.
 *
 * The list expands inline rather than opening a modal. There is no `Modal`
 * anywhere in this app — react-native-web renders it through a portal outside
 * the navigator, and the stack sets `statusBarHidden`/`navigationBarHidden`
 * that a portal escapes — so the proven pattern here is ordinary layout.
 *
 * Row-shaped rather than a row of pills on purpose: pills have to share one
 * line, so a language name that is longer in one translation than another
 * either overflows its pill or squeezes its neighbours. A list has as much
 * width as the screen and does not care how long "Türkçe" is.
 */

import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PressableScale } from "./PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading glyph — a flag emoji for languages. */
  icon?: string;
}

export function SelectRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.value === value);

  return (
    <View>
      <PressableScale style={styles.row} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.right}>
          {current?.icon ? <Text style={styles.icon}>{current.icon}</Text> : null}
          <Text style={styles.value} numberOfLines={1}>
            {current?.label ?? value}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </View>
      </PressableScale>

      {open
        ? options.map((option) => {
            const active = option.value === value;
            return (
              <PressableScale
                key={option.value}
                style={styles.option}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.icon ? <Text style={styles.icon}>{option.icon}</Text> : null}
                <Text style={[styles.optionLabel, active && styles.optionActive]}>
                  {option.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                ) : null}
              </PressableScale>
            );
          })
        : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 12,
  },
  title: { fontSize: 14, fontWeight: "600", color: colors.charcoal, flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  icon: { fontSize: 15 },
  value: { fontSize: 14, color: colors.muted },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 13,
    backgroundColor: colors.inputSurface,
  },
  optionLabel: { flex: 1, fontSize: 14, color: colors.charcoal },
  optionActive: { color: colors.primary, fontWeight: "600" },
}));
