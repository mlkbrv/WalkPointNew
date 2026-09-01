import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { lightColors, radii } from "../theme";
import { makeStyles } from "../contexts/ThemeContext";

export function GlassCard({ children, style, dark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[dark ? styles.dark : styles.light, style]}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  light:
    // A soft shadow only in the light palette: on a dark surface a black
    // drop-shadow is either invisible or muddy, so dark mode separates cards
    // from the canvas with the border below instead — the MD3 elevation rule
    // this app already follows. Checked by object identity against the light
    // palette itself, not the `dark` prop, because that prop is a per-instance
    // override (a screen forcing a dark-styled card regardless of theme, e.g.
    // a celebration screen), not the system's actual scheme.
    colors === lightColors
      ? {
          backgroundColor: colors.card,
          borderRadius: radii.lg,
          // Border *and* shadow. A white card on the near-white canvas measures
          // 1.089:1 — its whole edge is the shadow, and how strongly a platform
          // paints a soft shadow varies enough that on some devices the cards
          // dissolve into the page. The hairline guarantees an edge exists; the
          // shadow still does the lifting where it renders well.
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 3,
        }
      : {
          backgroundColor: colors.card,
          borderRadius: radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
  dark: {
    backgroundColor: colors.cardDark,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDark,
  },
}));
