import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../theme";

export function GlassCard({ children, style, dark }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[dark ? styles.dark : styles.light, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  light: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    ...shadows.glass,
  },
  dark: {
    backgroundColor: "rgba(18,20,23,0.92)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});
