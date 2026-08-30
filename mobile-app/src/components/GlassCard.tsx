import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { radii } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function GlassCard({ children, style, dark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[dark ? styles.dark : styles.light, style]}>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  light: {
    // A plain surface with a hairline, not frosted glass over a drop shadow.
    // Translucency and a 24pt radius on every container is the look that reads
    // as decoration rather than structure; a grouped section with a real edge
    // is what the system's own lists do.
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
