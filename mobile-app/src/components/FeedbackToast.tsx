import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { radii } from "../theme";
import { useStride } from "../contexts/StrideContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function FeedbackToast() {
  const styles = useStyles();
  const { toast, dismissToast } = useStride();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, 2200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return null;

  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.wrap}>
      <View style={styles.card}>
        {toast.emoji ? <Text style={styles.emoji}>{toast.emoji}</Text> : null}
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.charcoal,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.full,
  },
  emoji: { fontSize: 16 },
  text: { color: colors.textLight, fontWeight: "700", fontSize: 13 },
}));
