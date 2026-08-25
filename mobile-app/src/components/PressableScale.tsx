import React from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
};

export function PressableScale({ children, onPress, style, disabled, haptic = true }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      onPress={() => {
        if (haptic) Haptics.selectionAsync();
        onPress?.();
      }}
      style={[styles.base, style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {},
});
