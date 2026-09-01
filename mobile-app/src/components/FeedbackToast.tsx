/**
 * The transient message that drops in from the top.
 *
 * On React Native's own `Animated` — see `PressableScale` for why Reanimated is
 * gone. The exit animation is the reason this keeps its own `visible` state:
 * unmounting on `toast === null` would cut the fade off, so the component
 * outlives the toast by exactly the length of the fade.
 */

import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import { radii } from "../theme";
import { useStepoint } from "../contexts/StepointContext";
import { makeStyles } from "../contexts/ThemeContext";

const FADE_MS = 220;
const VISIBLE_MS = 2200;

export function FeedbackToast() {
  const styles = useStyles();
  const { toast, dismissToast } = useStepoint();

  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(-16)).current;
  /** Held one frame longer than `toast` so the exit animation can play out. */
  const [shown, setShown] = useState(toast);

  useEffect(() => {
    if (toast) {
      setShown(toast);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(dismissToast, VISIBLE_MS);
      return () => clearTimeout(timer);
    }

    if (!shown) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(offset, { toValue: -16, duration: FADE_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setShown(null);
    });

    // Same reason as the splash: an interrupted animation reports
    // finished:false, and clearing only on `finished` would leave the toast on
    // screen indefinitely with no way to dismiss it.
    const failsafe = setTimeout(() => setShown(null), FADE_MS + 200);
    return () => clearTimeout(failsafe);
    // `shown` is deliberately not a dependency: reacting to it would restart the
    // exit animation it just finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, dismissToast, opacity, offset]);

  if (!shown) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY: offset }] }]}>
      <View style={styles.card}>
        {shown.emoji ? <Text style={styles.emoji}>{shown.emoji}</Text> : null}
        <Text style={styles.text}>{shown.message}</Text>
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
  emoji: { fontSize: 17 },
  text: { color: colors.textLight, fontWeight: "600", fontSize: 15 },
}));
