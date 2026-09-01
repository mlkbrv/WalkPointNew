/**
 * Horizontal swipe between tabs, layered over the ordinary bottom-tab
 * navigator.
 *
 * The tidier route is `@react-navigation/material-top-tabs`, which is built on
 * a pager and swipes natively. It was tried and reverted: v6 of it wants
 * `react-native-tab-view@3` while the tree resolves 4.x, and the mismatch makes
 * the bar render as nothing at all — an app with no navigation. Swapping the
 * navigator puts the entire tab bar at risk to add a gesture; wrapping it puts
 * only the gesture at risk. If this handler misbehaves the worst case is that a
 * swipe does nothing and every tap still works.
 *
 * Uses the legacy `PanGestureHandler` rather than the `Gesture.Pan()` API on
 * purpose: the new one delivers its callbacks as Reanimated worklets, and
 * Reanimated is not in this project (its CMake build hangs on Windows).
 * `PanGestureHandler` calls back on the JS thread and needs nothing extra.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Animated } from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useIsFocused, useNavigation } from "@react-navigation/native";

import { TABS } from "./tabs";

/**
 * Horizontal travel that counts as a deliberate swipe rather than a stray drag.
 * Raised from 60: at that distance an ordinary diagonal scroll kept tipping the
 * screen over, so the tab felt like it changed at random.
 */
const DISTANCE = 90;
/** …or a shorter drag thrown fast enough to read as a flick. */
const VELOCITY = 800;
/** The incoming screen fades rather than appearing at once. */
const FADE_MS = 160;

export function TabSwipeArea({ index, children }: { index: number; children: ReactNode }) {
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  const isFocused = useIsFocused();
  // Guards against a single gesture firing twice as the handler settles.
  const handled = useRef(false);

  // Without this a tab change is an instant swap, which reads as a jump. One
  // short fade is enough to make it a transition; the bottom-tab navigator in
  // this version has no built-in screen animation to lean on.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isFocused) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [isFocused, fade]);

  const onStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    // Every tab visited so far keeps its own mounted handler, and the one that
    // just came into view can be handed the same gesture's end event — which
    // navigated again, walking the swipe across several tabs at once. `handled`
    // only guards one instance, so the focus check is what stops the chain.
    if (!isFocused) return;

    const { state, translationX, translationY, velocityX } = e.nativeEvent;

    if (state === State.BEGAN || state === State.ACTIVE) {
      if (state === State.BEGAN) handled.current = false;
      return;
    }
    if (state !== State.END || handled.current) return;

    // A drag that is mostly vertical is a scroll someone started at an angle.
    // The ratio is deliberately strict: at 1.5 a mostly-vertical flick still
    // qualified, which is the other half of why the tabs felt twitchy.
    if (Math.abs(translationX) < Math.abs(translationY) * 2.5) return;

    const far = Math.abs(translationX) > DISTANCE;
    const fast = Math.abs(velocityX) > VELOCITY;
    if (!far && !fast) return;

    const next = translationX < 0 ? index + 1 : index - 1;
    if (next < 0 || next >= TABS.length) return;

    handled.current = true;
    navigation.navigate(TABS[next].name);
  };

  return (
    <PanGestureHandler
      onHandlerStateChange={onStateChange}
      // Only claim the gesture once it is decisively horizontal, so vertical
      // scrolling and the horizontal rails inside a screen keep working.
      activeOffsetX={[-30, 30]}
      failOffsetY={[-25, 25]}
    >
      <Animated.View style={{ flex: 1, opacity: fade }} collapsable={false}>
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}
