/**
 * Full-screen story viewer.
 *
 * The API returns one media item per story; `storyGroups` in ServerDataContext
 * folds a partner's live stories into the frames this viewer steps through, so
 * "a story" means the same thing here and in the rail.
 *
 * A frame is marked seen when it is *shown*, not when it finishes — a user who
 * taps past a frame has still seen it, and the endpoint is idempotent.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RootStackParamList } from "../types";
import { useServerData } from "../contexts/ServerDataContext";
import { radii } from "../theme";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");
const DURATION = 5000;

export function StoriesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, "Stories">>();
  const insets = useSafeAreaInsets();
  const { storyGroups, markStorySeen } = useServerData();

  const startIndex = Math.max(
    0,
    storyGroups.findIndex((group) => group.partnerId === route.params?.startId),
  );

  const [storyIndex, setStoryIndex] = useState(startIndex);
  const [frameIndex, setFrameIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);
  const elapsedRef = useRef(0);

  const story = storyGroups[storyIndex];
  const frames = useMemo(() => story?.frames ?? [], [story]);
  const frame = frames[frameIndex];

  const goClose = useCallback(() => navigation.goBack(), [navigation]);

  const advance = useCallback(() => {
    if (frameIndex + 1 < frames.length) {
      setFrameIndex((index) => index + 1);
    } else if (storyIndex + 1 < storyGroups.length) {
      setStoryIndex((index) => index + 1);
      setFrameIndex(0);
    } else {
      goClose();
      return;
    }
    elapsedRef.current = 0;
    setProgress(0);
  }, [frameIndex, frames.length, storyIndex, storyGroups.length, goClose]);

  const rewind = useCallback(() => {
    if (frameIndex > 0) {
      setFrameIndex((index) => index - 1);
    } else if (storyIndex > 0) {
      const previous = storyGroups[storyIndex - 1];
      setStoryIndex((index) => index - 1);
      setFrameIndex(Math.max(0, (previous?.frames.length ?? 1) - 1));
    }
    elapsedRef.current = 0;
    setProgress(0);
  }, [frameIndex, storyIndex, storyGroups]);

  // Showing a frame is what "seen" means.
  useEffect(() => {
    if (frame) void markStorySeen(frame.id);
  }, [frame, markStorySeen]);

  useEffect(() => {
    if (!frame) return;

    const tick = 50;
    const timer = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += tick;
      const ratio = elapsedRef.current / DURATION;
      setProgress(Math.min(ratio, 1));
      if (ratio >= 1) advance();
    }, tick);

    return () => clearInterval(timer);
  }, [frame, advance]);

  // The feed can empty out while the viewer is open — every story expires.
  useEffect(() => {
    if (storyGroups.length === 0) goClose();
  }, [storyGroups.length, goClose]);

  if (!story || !frame) {
    return (
      <View style={styles.root}>
        <View style={[styles.emptyBox, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="images-outline" size={40} color={colors.textLight} />
          <Text style={styles.emptyText}>No stories right now.</Text>
          <Pressable onPress={goClose} style={styles.emptyClose}>
            <Text style={styles.emptyCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Image source={{ uri: frame.media_path }} style={styles.media} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.75)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.bars}>
          {frames.map((item, index) => (
            <View key={item.id} style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:
                      index < frameIndex
                        ? "100%"
                        : index === frameIndex
                          ? `${Math.round(progress * 100)}%`
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          {story.logo ? (
            <Image source={{ uri: story.logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="storefront-outline" size={16} color={colors.white} />
            </View>
          )}
          <Text style={styles.brand}>{story.partnerName}</Text>
          <Pressable onPress={goClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {/* Left half rewinds, right half advances; holding either pauses. */}
      <View style={styles.touchLayer}>
        <Pressable
          style={styles.touchHalf}
          onPress={rewind}
          onPressIn={() => (pausedRef.current = true)}
          onPressOut={() => (pausedRef.current = false)}
        />
        <Pressable
          style={styles.touchHalf}
          onPress={advance}
          onPressIn={() => (pausedRef.current = true)}
          onPressOut={() => (pausedRef.current = false)}
        />
      </View>

      {frame.caption ? (
        <View style={[styles.captionBox, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.caption}>{frame.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: "#000", width, height },
  media: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },

  top: { paddingHorizontal: 12 },
  bars: { flexDirection: "row", gap: 4 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  barFill: { height: 3, backgroundColor: colors.white },

  header: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  logo: { width: 32, height: 32, borderRadius: radii.full },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  brand: { flex: 1, color: colors.white, fontSize: 14, fontWeight: "700" },

  touchLayer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", top: 90 },
  touchHalf: { flex: 1 },

  captionBox: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  caption: { color: colors.white, fontSize: 16, fontWeight: "600", lineHeight: 22 },

  emptyBox: { flex: 1, alignItems: "center", gap: 12 },
  emptyText: { color: colors.textLight, fontSize: 15, fontWeight: "600" },
  emptyClose: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  emptyCloseText: { color: colors.white, fontWeight: "600" },
}));
