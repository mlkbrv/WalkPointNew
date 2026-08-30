/**
 * Live workout tracking.
 *
 * The session itself lives on the server (see `useWorkoutSession`); this screen
 * owns only what is genuinely local — the map style and the hold-to-finish gesture.
 * The bonus shown afterwards is whatever the server actually paid, so a session
 * flagged as implausible reports zero here rather than a number we invented.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { useStride, formatDuration } from "../contexts/StrideContext";
import { useServerData } from "../contexts/ServerDataContext";
import { useWorkoutSession } from "../hooks/useWorkoutSession";
import { ActiveWorkout } from "../types";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MAP_COLORS: Record<ActiveWorkout["mapView"], string> = {
  neon: "#090a0f",
  satellite: "#0c1510",
  slate: "#1e293b",
};

export function TrackScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { showToast } = useStride();
  const { refreshWallet } = useServerData();
  const { metrics, isActive, isPaused, busy, error, start, togglePause, finish } =
    useWorkoutSession();

  const [mapView, setMapViewState] = useState<ActiveWorkout["mapView"]>("neon");
  const [showMapDrawer, setShowMapDrawer] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const pressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapBg = MAP_COLORS[mapView];
  const offsetX = SCREEN_W / 2 - 150;
  const offsetY = SCREEN_H / 2 - 300;

  const onStart = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await start();
  }, [start]);

  const onFinish = useCallback(async () => {
    const result = await finish();
    if (!result) return;

    // The wallet changed on the server, so re-read it rather than adding locally.
    void refreshWallet();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Sessions record activity; coins come from steps alone. Announcing
     // "+0 coins" here would read as a bug rather than as the rule.
    showToast(
      result.workout.is_suspicious
        ? "Workout saved \u2014 this one is under review"
        : "Workout saved",
    );
    navigation.navigate("WorkoutSummary");
  }, [finish, refreshWallet, showToast, navigation]);

  const onFinishHoldStart = () => {
    let current = 0;
    pressRef.current = setInterval(() => {
      current += 5;
      if (current >= 100) {
        if (pressRef.current) clearInterval(pressRef.current);
        setPressProgress(0);
        void onFinish();
      } else {
        setPressProgress(current);
      }
    }, 100);
  };

  const onFinishHoldEnd = () => {
    if (pressRef.current) clearInterval(pressRef.current);
    setPressProgress(0);
  };

  const setMapView = (next: ActiveWorkout["mapView"]) => {
    setMapViewState(next);
    setShowMapDrawer(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: mapBg }]}>
      <View style={styles.mapLayer} pointerEvents="none">
        {mapView === "slate"
          ? Array.from({ length: 16 }).map((_, i) => (
              <View
                key={`v-${i}`}
                style={[styles.gridLineV, { left: i * 25 }]}
              />
            ))
          : null}
        {mapView === "slate"
          ? Array.from({ length: 30 }).map((_, i) => (
              <View
                key={`h-${i}`}
                style={[styles.gridLineH, { top: i * 25 }]}
              />
            ))
          : null}
        {mapView === "neon" ? (
          <>
            <View style={[styles.road, { left: "15%", height: "100%", width: 2, transform: [{ rotate: "4deg" }] }]} />
            <View style={[styles.road, { left: "40%", height: "100%", width: 2, transform: [{ rotate: "-2deg" }] }]} />
            <View style={[styles.road, { left: "65%", height: "100%", width: 2, transform: [{ rotate: "3deg" }] }]} />
            <View style={[styles.roadH, { top: "18%" }]} />
            <View style={[styles.roadH, { top: "45%" }]} />
            <View style={[styles.roadH, { top: "78%" }]} />
            <View style={styles.neonGlow} />
          </>
        ) : null}
        {metrics.routeCoordinates.map((pt, idx) => {
          const isLast = idx === metrics.routeCoordinates.length - 1;
          return (
            <View
              key={`${idx}-${pt.x}-${pt.y}`}
              style={[
                isLast ? styles.routePulse : styles.routeDot,
                {
                  left: pt.x + offsetX - (isLast ? 8 : 3),
                  top: pt.y + offsetY - (isLast ? 8 : 3),
                },
              ]}
            />
          );
        })}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.gpsPill}>
          <Ionicons name="locate" size={14} color={colors.emerald} />
          <Text style={styles.gpsText}>
            {isActive ? (isPaused ? "GPS PAUSED" : "GPS TRACKING ACTIVE") : "GPS READY"}
          </Text>
        </View>
        <PressableScale style={styles.layerBtn} onPress={() => setShowMapDrawer(true)}>
          <Ionicons name="layers-outline" size={18} color={colors.textLight} />
        </PressableScale>
      </View>

      {showMapDrawer ? (
        <View style={styles.drawer}>
          <View style={styles.drawerHead}>
            <Text style={styles.drawerTitle}>Map Style</Text>
            <PressableScale onPress={() => setShowMapDrawer(false)}>
              <Ionicons name="close" size={20} color={colors.textLight} />
            </PressableScale>
          </View>
          {(["neon", "satellite", "slate"] as const).map((style) => (
            <PressableScale
              key={style}
              style={[styles.mapOption, mapView === style && styles.mapOptionActive]}
              onPress={() => setMapView(style)}
            >
              <Text style={styles.mapOptionText}>{style.toUpperCase()}</Text>
              {mapView === style ? (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              ) : null}
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={[styles.hud, { bottom: insets.bottom + 88 }]}>
        <GlassCard dark style={styles.hudCard}>
          <View style={styles.handle} />
          {!isActive ? (
            <View style={styles.idle}>
              <Ionicons name="compass-outline" size={44} color={colors.primary} />
              <Text style={styles.idleTitle}>Outdoor GPS Track</Text>
              <Text style={styles.idleBody}>
                Record live paths on the map and earn bonus Step-Tokens.
              </Text>
              <PressableScale
                style={styles.startBtn}
                disabled={busy}
                onPress={() => void onStart()}
              >
                {busy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="play" size={14} color={colors.white} />
                    <Text style={styles.startText}>START TRAINING</Text>
                  </>
                )}
              </PressableScale>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          ) : (
            <View style={styles.active}>
              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>DURATION</Text>
                  <Text style={styles.metricValue}>{formatDuration(metrics.durationSeconds)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>DISTANCE</Text>
                  <Text style={styles.metricValue}>{metrics.distanceKm.toFixed(2)} km</Text>
                </View>
              </View>
              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>KCAL</Text>
                  <Text style={styles.metricValue}>{metrics.caloriesKcal}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>AVG SPEED</Text>
                  <Text style={styles.metricValue}>{metrics.avgSpeedKmH.toFixed(1)} km/h</Text>
                </View>
              </View>
              <View style={styles.controls}>
                <PressableScale style={styles.pauseBtn} onPress={togglePause}>
                  <Ionicons
                    name={isPaused ? "play" : "pause"}
                    size={22}
                    color={colors.white}
                  />
                </PressableScale>
                <Pressable
                  style={styles.finishBtn}
                  onPressIn={onFinishHoldStart}
                  onPressOut={onFinishHoldEnd}
                >
                  <View style={[styles.finishFill, { width: `${pressProgress}%` }]} />
                  <Ionicons name="stop" size={18} color={colors.white} />
                  <Text style={styles.finishText}>
                    {pressProgress > 0 ? "HOLD…" : "FINISH"}
                  </Text>
                </Pressable>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          )}
        </GlassCard>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1 },
  mapLayer: { ...StyleSheet.absoluteFill },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  road: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  roadH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  neonGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(129,64,243,0.08)",
    top: "40%",
    left: "28%",
  },
  routeDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  routePulse: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "rgba(11,13,16,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  gpsText: {
    color: "#E2E8F0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  layerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(11,13,16,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawer: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 180,
    backgroundColor: "rgba(11,13,16,0.92)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 12,
    zIndex: 30,
    gap: 8,
  },
  drawerHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  drawerTitle: { color: colors.textLight, fontWeight: "800", fontSize: 12 },
  mapOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  mapOptionActive: {
    backgroundColor: "rgba(129,64,243,0.2)",
    borderWidth: 1,
    borderColor: "rgba(129,64,243,0.4)",
  },
  mapOptionText: { color: colors.textLight, fontSize: 11, fontWeight: "700" },
  hud: { position: "absolute", left: 16, right: 16, zIndex: 20 },
  hudCard: { padding: 20 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 16,
  },
  idle: { alignItems: "center", gap: 12, paddingVertical: 8 },
  idleTitle: { color: colors.white, fontSize: 16, fontWeight: "900" },
  idleBody: {
    color: colors.mutedDark,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 16,
  },
  startBtn: {
    marginTop: 8,
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  startText: { color: colors.white, fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  active: { gap: 16 },
  metrics: { flexDirection: "row", gap: 16 },
  metric: { flex: 1 },
  metricLabel: {
    color: colors.mutedDark,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  metricValue: { color: colors.white, fontSize: 22, fontWeight: "900" },
  controls: { flexDirection: "row", gap: 12, marginTop: 4 },
  pauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  finishBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.coralInk,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  finishFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  finishText: { color: colors.white, fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  errorText: {
    color: colors.coralInk,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
}));
