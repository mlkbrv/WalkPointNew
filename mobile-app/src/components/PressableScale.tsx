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
    // The caller's style goes on the Pressable, not on this wrapper, so the hit
    // area is exactly the styled box — the same as when this used Reanimated's
    // animated Pressable directly.
    //
    // Putting the style on the wrapper and giving the Pressable `flex: 0` does
    // not work: in React Native `flex: 0` also sets `flexBasis: 0`, so inside a
    // column container the Pressable collapses to zero height. The children
    // still paint (they overflow), so the button looks perfectly normal and
    // simply cannot be tapped — with no error anywhere.
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        onPressIn={() => spring(0.96)}
        onPressOut={() => spring(1)}
        onPress={() => {
          // The handler runs first, and the haptic is isolated behind its own
          // guard. Called the other way round — `Haptics.selectionAsync()` then
          // `onPress()` — anything that module throws synchronously (it has no
          // implementation on every platform this app ships to) takes the real
          // handler down with it, and the button does nothing at all with no
          // error visible on screen.
          onPress?.();
          if (haptic) {
            try {
              void Haptics.selectionAsync().catch(() => undefined);
            } catch {
              // A device with no haptic engine is not a reason to break a tap.
            }
          }
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
