/**
 * The launch animation.
 *
 * Rebuilt on React Native's own `Animated`. The previous version was a
 * 3.8-second Reanimated choreography — footprints counting to 5,000, a coin
 * bursting into particles, a coupon, then the wordmark — and it had to go for
 * two reasons.
 *
 * The blocking one: Reanimated 4 requires the New Architecture and its CMake
 * build loops on Windows (`ninja: manifest 'build.ninja' still dirty after 100
 * tries`), so the app could not be built there at all. Only three components
 * used it, and none needed a worklet.
 *
 * The other: it told the wrong story. It centred on a coin captioned "STEP
 * COIN", a name the product no longer uses, and it held a first-time user on a
 * static screen for nearly four seconds before anything was tappable. This
 * shows the same mark as the app icon, resolves in about a second, and gets out
 * of the way.
 */

import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { makeStyles } from "../contexts/ThemeContext";

type Props = { onFinish: () => void };

/**
 * The stride mark from the app icon.
 *
 * Same control points as `deploy`-time icon generation, mapped into a 120x120
 * viewBox — so the splash and the launcher icon are the same shape, not two
 * drawings that merely resemble each other.
 */
function StepointMark({ size = 104 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.40" />
          <Stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="60" cy="60" r="58" fill="url(#splashGlow)" />
      <Path
        d="M85.1 28.0 C53.0 18.2 34.9 40.5 61.4 56.5 C87.8 73.9 69.7 99.0 36.3 90.6"
        stroke="#A78BFA"
        strokeWidth={12.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* The next step, ahead of the path. */}
      <Circle cx="87.8" cy="87.8" r="5.6" fill="#A78BFA" />
    </Svg>
  );
}

export function AnimatedSplashScreen({ onFinish }: Props) {
  const styles = useStyles();

  const markIn = useRef(new Animated.Value(0)).current;
  const wordIn = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // `start`'s callback reports finished:false when an animation is
    // interrupted — backgrounding the app during launch is enough. Gating the
    // hand-off on `finished` alone would leave this overlay up forever: opaque,
    // covering the whole app, with nothing the user could do about it. So the
    // hand-off happens on whichever comes first, and only once.
    let handedOver = false;
    const handOver = () => {
      if (handedOver) return;
      handedOver = true;
      onFinish();
    };

    const animation = Animated.sequence([
      Animated.timing(markIn, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(wordIn, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(260),
      Animated.timing(overlay, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    animation.start(handOver);
    const failsafe = setTimeout(handOver, 2500);

    return () => {
      clearTimeout(failsafe);
      animation.stop();
    };
  }, [markIn, wordIn, overlay, onFinish]);

  return (
    <Animated.View style={[styles.root, { opacity: overlay }]} pointerEvents="none">
      <Animated.View
        style={{
          opacity: markIn,
          transform: [
            { scale: markIn.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
          ],
        }}
      >
        <StepointMark />
      </Animated.View>

      <Animated.View
        style={{
          opacity: wordIn,
          transform: [
            { translateY: wordIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}
      >
        <Text style={styles.brand}>Stepoint</Text>
        <Text style={styles.tagline}>Move more. Earn more.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    zIndex: 999,
  },
  brand: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
  },
  tagline: {
    color: colors.mutedDark,
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
    marginTop: 8,
  },
}));
