/**
 * The small "This Week ▾" period selector.
 *
 * The popover is an absolutely-positioned sibling, not a `Modal`. React
 * Native's `Modal` renders through a portal outside the navigator's tree, and
 * this app's stack sets `statusBarHidden` / `navigationBarHidden`, so a modal
 * escapes both the theme and those options and behaves differently again under
 * react-native-web. There is no `Modal` anywhere in this codebase; the pattern
 * that is proven here is the absolute overlay `AnimatedSplashScreen` uses, so
 * that is what this follows.
 *
 * The caller must give the containing row `zIndex` and must not clip it with
 * `overflow: "hidden"`, or the open list is painted underneath its neighbours.
 */

import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PressableScale } from "./PressableScale";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function DropdownChip<T extends string>({
  value,
  options,
  onChange,
  align = "right",
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  align?: "left" | "right";
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <PressableScale style={styles.chip} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.chipText}>{value}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={13}
          color={colors.slate}
        />
      </PressableScale>

      {open ? (
        <>
          {/* Catches the tap that closes the list. Sized to the screen rather
              than the chip, so a tap anywhere outside dismisses it. */}
          <PressableScale haptic={false} style={styles.scrim} onPress={() => setOpen(false)}>
            <View />
          </PressableScale>

          <View style={[styles.menu, align === "left" ? { left: 0 } : { right: 0 }]}>
            {options.map((option) => (
              <PressableScale
                key={option}
                haptic={false}
                style={styles.option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, option === value && styles.optionActive]}>
                  {option}
                </Text>
                {option === value ? (
                  <Ionicons name="checkmark" size={14} color={colors.primary} />
                ) : null}
              </PressableScale>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { position: "relative", zIndex: 20 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.slate },
  scrim: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
  },
  menu: {
    position: "absolute",
    top: 40,
    minWidth: 148,
    borderRadius: 12,
    paddingVertical: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 21,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionText: { fontSize: 14, color: colors.charcoal },
  optionActive: { color: colors.primary, fontWeight: "600" },
}));
