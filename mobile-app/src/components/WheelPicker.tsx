/**
 * The scrolling number wheel from the reference's onboarding — age, height,
 * weight, step goal.
 *
 * A snapping `ScrollView` rather than a gesture handler: `snapToInterval` plus
 * `decelerationRate="fast"` is the whole behaviour, and it works identically
 * under react-native-web, which the app also ships.
 *
 * The rows are not `PressableScale`. A selection haptic on every row that
 * passes the centre would fire continuously through a flick, and the press
 * spring fights the scroll it is riding on. Tapping a row is handled by a plain
 * `Pressable` that scrolls it to the centre instead.
 */

import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function WheelPicker({
  values,
  value,
  onChange,
  unit,
  itemHeight = 48,
  visibleCount = 5,
}: {
  values: (number | string)[];
  value: number | string;
  onChange: (next: number | string) => void;
  unit?: string;
  itemHeight?: number;
  /** Must be odd, so one row is genuinely in the centre. */
  visibleCount?: number;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const ref = useRef<Animated.LegacyRef<typeof Animated.ScrollView>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const rows = visibleCount % 2 === 0 ? visibleCount + 1 : visibleCount;
  const padding = (itemHeight * (rows - 1)) / 2;
  const height = itemHeight * rows;

  const index = useMemo(() => {
    const found = values.indexOf(value);
    return found >= 0 ? found : 0;
  }, [values, value]);

  // Jump to the current value on mount and whenever it is changed from outside
  // (a unit switch rebuilds the whole list, for instance).
  useEffect(() => {
    const node = ref.current as unknown as { scrollTo?: (o: object) => void } | null;
    node?.scrollTo?.({ y: index * itemHeight, animated: false });
  }, [index, itemHeight]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
    const clamped = Math.max(0, Math.min(next, values.length - 1));
    if (values[clamped] !== value) onChange(values[clamped]);
  };

  return (
    <View style={[styles.root, { height }]}>
      {/* The selection band, behind the rows. */}
      <View
        pointerEvents="none"
        style={[styles.band, { top: padding, height: itemHeight }]}
      />

      <Animated.ScrollView
        ref={ref as never}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: padding }}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {values.map((v, i) => {
          // Distance from the centre drives both size and fade, so rows melt
          // away toward the edges the way the reference's do.
          const distance = Animated.subtract(scrollY, i * itemHeight);
          const opacity = distance.interpolate({
            inputRange: [-itemHeight * 2, -itemHeight, 0, itemHeight, itemHeight * 2],
            outputRange: [0.25, 0.55, 1, 0.55, 0.25],
            extrapolate: "clamp",
          });
          const scale = distance.interpolate({
            inputRange: [-itemHeight, 0, itemHeight],
            outputRange: [0.82, 1, 0.82],
            extrapolate: "clamp",
          });
          const selected = v === value;
          return (
            <Pressable
              key={`${v}-${i}`}
              onPress={() => {
                const node = ref.current as unknown as { scrollTo?: (o: object) => void } | null;
                node?.scrollTo?.({ y: i * itemHeight, animated: true });
                if (v !== value) onChange(v);
              }}
            >
              <Animated.View
                style={[styles.row, { height: itemHeight, opacity, transform: [{ scale }] }]}
              >
                <Text style={[styles.value, selected && { color: colors.primary }]}>{v}</Text>
                {selected && unit ? <Text style={styles.unit}>{unit}</Text> : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { alignSelf: "stretch", position: "relative" },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  value: { fontSize: 26, fontWeight: "600", color: colors.charcoal },
  unit: { fontSize: 14, color: colors.muted, marginTop: 8 },
}));
