import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { PressableScale } from "./PressableScale";

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  light?: boolean;
};

export function ScreenHeader({ title, onBack, right, light }: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <PressableScale onPress={onBack} style={[styles.btn, light && styles.btnLight]}>
          <Ionicons name="arrow-back" size={20} color={light ? colors.textLight : colors.charcoal} />
        </PressableScale>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={[styles.title, light && styles.titleLight]}>{title}</Text>
      {right || <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnLight: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  spacer: { width: 40 },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.charcoal,
  },
  titleLight: { color: colors.textLight },
});
