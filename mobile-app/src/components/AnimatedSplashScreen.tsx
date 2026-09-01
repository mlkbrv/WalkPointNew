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
import { Animated, Easing, Image, Text, View } from "react-native";

import { makeStyles } from "../contexts/ThemeContext";
// A static import, not require(): Metro resolves this to an asset ref and
// Vite to a URL, whereas `require` simply does not exist in the ESM web
// build and throws at module scope, taking the whole app down on load.
import icon from "../../assets/icon.png";

type Props = { onFinish: () => void };

/**
 * The app icon itself, not a redrawing of it.
 *
 * This used to be a hand-built SVG that had to be kept in step with whatever
 * the launcher icon looked like — two drawings that merely resembled each
 * other, and they had already drifted apart. Rendering `assets/icon.png`
 * means the splash cannot disagree with the icon, because it is the icon.
 */
function StepointMark({ size = 116 }: { size?: number }) {
  return (
    <Image
      // The two bundlers hand back different things for the same import: Vite a
      // URL string, Metro a numeric asset ref. Image takes the ref directly but
      // needs the string wrapped, so the shape is normalised here rather than
      // splitting this component by platform for one prop.
      source={typeof icon === "string" ? { uri: icon } : icon}
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
      resizeMode="contain"
    />
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
