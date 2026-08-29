/**
 * A button that dips slightly when pressed.
 *
 * Built on React Native's own `Animated` rather than Reanimated. Reanimated 4
 * requires the New Architecture and ships a CMake build that loops forever on
 * Windows (`ninja: manifest 'build.ninja' still dirty after 100 tries`), which
 * makes the app unbuildable there. Nothing here needs a worklet: it is one
 * spring on one transform, and `useNativeDriver` keeps it off the JS thread
 * just the same.
 */

import React, { useRef } from "react";
import { Animated, Pressable, StyleProp, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
};

export function PressableScale({ children, onPress, style, disabled, haptic = true }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      // Matches the damping the Reanimated version used closely enough that the
      // press feels unchanged.
      damping: toValue < 1 ? 15 : 12,
      stiffness: 220,
      mass: 0.6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        disabled={disabled}
        onPressIn={() => spring(0.96)}
        onPressOut={() => spring(1)}
        onPress={() => {
          if (haptic) void Haptics.selectionAsync();
          onPress?.();
        }}
        // The wrapper carries the caller's style, so the pressable itself only
        // has to fill it — otherwise padding would be applied twice.
        style={{ flex: 0 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
