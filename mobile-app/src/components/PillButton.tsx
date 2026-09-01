/**
 * The pill button the reference uses for every primary and secondary action.
 *
 * `flex` exists so callers never have to think about the `PressableScale`
 * width trap: that component puts the caller's style on its inner `Pressable`
 * and leaves its own wrapper unsized, so a `flex: 1` passed in from outside is
 * measured against a wrapper with no width and collapses. Here the flex lives
 * on an outer `View` where it means what it looks like it means, and the
 * side-by-side "Skip / Continue" row works without every caller rediscovering
 * that.
 */

import { Text, View } from "react-native";

import { PressableScale } from "./PressableScale";
import { makeStyles } from "../contexts/ThemeContext";

export function PillButton({
  label,
  variant = "filled",
  onPress,
  disabled,
  flex,
}: {
  label: string;
  /** `soft` is the lavender secondary; `ghost` is text-only. */
  variant?: "filled" | "soft" | "ghost";
  onPress: () => void;
  disabled?: boolean;
  flex?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={flex ? styles.flexSlot : undefined}>
      <PressableScale
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.base,
          variant === "filled" && styles.filled,
          variant === "soft" && styles.soft,
          variant === "ghost" && styles.ghost,
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.label,
            variant === "filled" && styles.labelFilled,
            variant !== "filled" && styles.labelSoft,
          ]}
        >
          {label}
        </Text>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flexSlot: { flex: 1 },
  base: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { backgroundColor: colors.primary },
  soft: { backgroundColor: colors.primarySoft },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: "700" },
  labelFilled: { color: colors.onPrimary },
  labelSoft: { color: colors.onPrimarySoft },
}));
