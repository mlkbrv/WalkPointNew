import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from "react-native-svg";

const AnimatedView = Animated.View;

type Props = {
  onFinish: () => void;
};

function FootprintIcon({ pulse }: { pulse: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.12]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.75, 1]),
  }));

  return (
    <AnimatedView style={[styles.iconWrap, style]}>
      <Svg width={88} height={88} viewBox="0 0 88 88">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#8140F3" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#8140F3" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="44" cy="44" r="40" fill="url(#glow)" />
        <G fill="#FAFAFC">
          <Ellipse cx="36" cy="28" rx="7" ry="10" />
          <Ellipse cx="48" cy="24" rx="5.5" ry="8" />
          <Ellipse cx="57" cy="30" rx="4.5" ry="7" />
          <Ellipse cx="28" cy="36" rx="4" ry="6" />
          <Path d="M30 46c0-6 6-10 14-10s14 4 14 10c0 10-6 20-14 22-8-2-14-12-14-22z" />
        </G>
      </Svg>
    </AnimatedView>
  );
}

function StepCoin() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="coinGlow" cx="35%" cy="30%" r="70%">
          <Stop offset="0%" stopColor="#B57CFF" />
          <Stop offset="55%" stopColor="#8140F3" />
          <Stop offset="100%" stopColor="#4B1FA8" />
        </RadialGradient>
      </Defs>
      <Circle cx="60" cy="64" r="46" fill="#4B1FA8" opacity="0.35" />
      <Circle cx="60" cy="58" r="46" fill="url(#coinGlow)" />
      <Circle cx="60" cy="58" r="38" fill="none" stroke="#E9D5FF" strokeWidth="3" opacity="0.7" />
      <Circle cx="60" cy="58" r="30" fill="none" stroke="#FAFAFC" strokeWidth="1.5" opacity="0.35" />
      <Path
        d="M60 38c-8 0-14 5-14 12 0 5 3 9 9 11l8 3c3 1 5 2 5 5s-3 5-8 5c-4 0-7-2-8-4"
        stroke="#FAFAFC"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M60 34v8M60 74v8" stroke="#FAFAFC" strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

function CouponTicket() {
  return (
    <View style={styles.ticket}>
      <View style={styles.ticketNotchLeft} />
      <View style={styles.ticketNotchRight} />
      <Text style={styles.ticketLabel}>REWARD</Text>
      <Text style={styles.ticketTitle}>Free Treat</Text>
      <View style={styles.ticketIcons}>
        <Text style={styles.foodEmoji}>🍔</Text>
        <Text style={styles.foodEmoji}>☕</Text>
      </View>
      <View style={styles.dashed} />
      <Text style={styles.ticketCode}>WALKPOINT</Text>
    </View>
  );
}

function Particle({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const angle = (index / 10) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const dist = interpolate(t, [0, 1], [0, 78 + (index % 3) * 12], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.2, 1], [0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: interpolate(t, [0, 1], [0.4, 1.1], Extrapolation.CLAMP) },
      ] as const,
    };
  });
  return <AnimatedView style={[styles.particle, style]} />;
}

function ParticleBurst({ progress }: { progress: SharedValue<number> }) {
  return (
    <View style={styles.particleLayer} pointerEvents="none">
      {Array.from({ length: 10 }, (_, i) => (
        <Particle key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}

export function AnimatedSplashScreen({ onFinish }: Props) {
  const [stepsDisplay, setStepsDisplay] = useState(0);
  const pulse = useSharedValue(0);
  const stepsSV = useSharedValue(0);
  const footprintOpacity = useSharedValue(1);
  const coinOpacity = useSharedValue(0);
  const coinScale = useSharedValue(0.2);
  const coinSpin = useSharedValue(0);
  const burst = useSharedValue(0);
  const couponOpacity = useSharedValue(0);
  const couponScale = useSharedValue(0.6);
  const foodPop = useSharedValue(0);
  const brandOpacity = useSharedValue(0);
  const brandScale = useSharedValue(0.9);
  const taglineOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 450, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.4, { duration: 200 })
    );

    stepsSV.value = withTiming(5000, { duration: 950, easing: Easing.out(Easing.cubic) });
    const stepInterval = setInterval(() => {
      setStepsDisplay(Math.min(5000, Math.round(stepsSV.value)));
    }, 32);

    const t1 = setTimeout(() => {
      clearInterval(stepInterval);
      setStepsDisplay(5000);
      footprintOpacity.value = withTiming(0, { duration: 280 });
      burst.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      coinOpacity.value = withTiming(1, { duration: 320 });
      coinScale.value = withSequence(
        withTiming(1.15, { duration: 280, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 180 })
      );
    }, 1000);

    const t2 = setTimeout(() => {
      coinSpin.value = withTiming(360, { duration: 700, easing: Easing.inOut(Easing.cubic) });
      coinOpacity.value = withDelay(450, withTiming(0, { duration: 220 }));
      couponOpacity.value = withDelay(400, withTiming(1, { duration: 280 }));
      couponScale.value = withDelay(
        400,
        withSequence(
          withTiming(1.08, { duration: 260, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 160 })
        )
      );
      foodPop.value = withDelay(520, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    }, 2000);

    const t3 = setTimeout(() => {
      couponOpacity.value = withTiming(0, { duration: 280 });
      couponScale.value = withTiming(0.85, { duration: 280 });
      brandOpacity.value = withTiming(1, { duration: 420 });
      brandScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      taglineOpacity.value = withDelay(180, withTiming(1, { duration: 380 }));
    }, 3000);

    const t4 = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, 3800);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinOpacity.value,
    transform: [
      { scale: coinScale.value },
      { rotate: `${coinSpin.value}deg` },
    ] as const,
  }));
  const couponStyle = useAnimatedStyle(() => ({
    opacity: couponOpacity.value,
    transform: [{ scale: couponScale.value }] as const,
  }));
  const foodStyle = useAnimatedStyle(() => ({
    opacity: foodPop.value,
    transform: [
      { translateY: interpolate(foodPop.value, [0, 1], [18, -8]) },
      { scale: interpolate(foodPop.value, [0, 1], [0.4, 1]) },
    ] as const,
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ scale: brandScale.value }] as const,
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const footprintBlock = useAnimatedStyle(() => ({
    opacity: footprintOpacity.value,
    transform: [{ scale: interpolate(footprintOpacity.value, [0, 1], [0.8, 1]) }] as const,
  }));

  return (
    <AnimatedView style={[styles.root, overlayStyle]}>
      <View style={styles.stage}>
        <AnimatedView style={[styles.centerAbs, footprintBlock]}>
          <FootprintIcon pulse={pulse} />
          <Text style={styles.stepsCount}>{stepsDisplay.toLocaleString()}</Text>
          <Text style={styles.stepsLabel}>STEPS</Text>
        </AnimatedView>

        <ParticleBurst progress={burst} />

        <AnimatedView style={[styles.centerAbs, coinStyle]}>
          <StepCoin />
          <Text style={styles.coinCaption}>STEP COIN</Text>
        </AnimatedView>

        <AnimatedView style={[styles.centerAbs, couponStyle]}>
          <CouponTicket />
          <AnimatedView style={[styles.foodRow, foodStyle]}>
            <Text style={styles.foodBig}>🍔</Text>
            <Text style={styles.foodBig}>☕</Text>
          </AnimatedView>
        </AnimatedView>

        <AnimatedView style={[styles.centerAbs, brandStyle]}>
          <Text style={styles.logo}>WALKPOINT</Text>
          <View style={styles.logoUnderline} />
          <AnimatedView style={tagStyle}>
            <Text style={styles.tagline}>Walk ➔ Earn ➔ Enjoy</Text>
          </AnimatedView>
        </AnimatedView>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#12131A",
    zIndex: 999,
    elevation: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    width: "100%",
    height: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  centerAbs: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginBottom: 12,
  },
  stepsCount: {
    color: "#FAFAFC",
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 1,
  },
  stepsLabel: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
  },
  coinCaption: {
    marginTop: 10,
    color: "#B57CFF",
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 12,
  },
  ticket: {
    width: 210,
    backgroundColor: "#FAFAFC",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.25)",
  },
  ticketNotchLeft: {
    position: "absolute",
    left: -10,
    top: "50%",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#12131A",
    marginTop: -10,
  },
  ticketNotchRight: {
    position: "absolute",
    right: -10,
    top: "50%",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#12131A",
    marginTop: -10,
  },
  ticketLabel: {
    color: "#8140F3",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  ticketTitle: {
    marginTop: 6,
    color: "#121417",
    fontSize: 22,
    fontWeight: "900",
  },
  ticketIcons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  foodEmoji: {
    fontSize: 22,
  },
  dashed: {
    width: "100%",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    marginVertical: 12,
  },
  ticketCode: {
    color: "#64748B",
    fontWeight: "700",
    letterSpacing: 2,
    fontSize: 11,
  },
  foodRow: {
    position: "absolute",
    top: -28,
    flexDirection: "row",
    gap: 28,
  },
  foodBig: {
    fontSize: 34,
  },
  logo: {
    color: "#FAFAFC",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 4,
  },
  logoUnderline: {
    marginTop: 10,
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#8140F3",
  },
  tagline: {
    marginTop: 16,
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  particleLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8140F3",
  },
});
