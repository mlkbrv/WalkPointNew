import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { radii } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function GlassCard({ children, style, dark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  const styles = useStyles();
  const { shadows } = useTheme();
  return (
    <View style={[dark ? styles.dark : [styles.light, shadows.glass], style]}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  light: {
    backgroundColor: colors.cardTranslucent,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.cardTranslucentBorder,
  },
  dark: {
    backgroundColor: "rgba(18,20,23,0.92)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
}));
