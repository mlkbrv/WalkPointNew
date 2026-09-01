/**
 * The recorded route on a real basemap.
 *
 * **Tiles: OpenFreeMap.** No key, no account, no rate limit, and its terms
 * permit app use. `tile.openstreetmap.org` is the obvious alternative and is
 * explicitly forbidden for applications — their policy bans it and they block
 * offenders — so it is not an option however convenient. The attribution stays
 * on screen because ODbL requires it, not as decoration.
 *
 * **Why the camera is driven rather than left alone.** While recording, the
 * route grows point by point and a static camera would leave the walk crawling
 * off the edge within a minute. For a finished route the whole shape is the
 * point instead, so the camera fits its bounds. A camera stop takes a centre
 * *or* bounds, never both, which is why the two cases are separate elements.
 *
 * Native-only: MapLibre's binding has no web implementation, and importing it
 * on web breaks the bundle outright. `RouteMap.tsx` keeps the web build on the
 * plain SVG trace.
 */

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type LngLatBounds,
} from "@maplibre/maplibre-react-native";

import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { radii } from "../theme";
import type { Point } from "../utils/geo";

/** Liberty: coloured roads, parks and POI labels — the look people expect from
 *  a map. Positron, the previous choice, is deliberately near-monochrome; it
 *  flattered the violet route line but read as washed out on its own.
 *  OpenFreeMap serves all of its styles without a key or an account. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** How far the basemap has got. A map that fails silently is indistinguishable
 *  from a map that is merely slow, and both look like a grey box — which is
 *  exactly how this arrived as a bug report with nothing to act on. */
type Stage = "loading" | "styled" | "ready" | "failed";

export function RouteMap({
  points,
  height = 260,
  follow = false,
  center = null,
  onLocate,
  locating = false,
}: {
  points: Point[];
  height?: number;
  /** True while recording: keep the newest position centred instead of fitting. */
  follow?: boolean;
  /** Where to look when there is no route yet — usually the device. */
  center?: Point | null;
  /** Shows the locate button when given. */
  onLocate?: () => void;
  locating?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [stage, setStage] = useState<Stage>("loading");

  const line = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: points },
    }),
    [points],
  );

  const ends = useMemo(() => {
    if (points.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: [points[0], points[points.length - 1]].map((p) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: p },
      })),
    };
  }, [points]);

  // [west, south, east, north], the order MapLibre expects.
  const bounds = useMemo<LngLatBounds | null>(() => {
    if (points.length < 2) return null;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  }, [points]);

  const last = points.length > 0 ? points[points.length - 1] : null;

  return (
    <View style={[styles.frame, { height }]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        logo={false}
        attribution={false}
        // TextureView, not the default GLSurfaceView. A GL surface is punched
        // through the view hierarchy rather than composited into it, so on
        // Android it ignores a rounded, `overflow: hidden` parent — which this
        // card is — and the map comes out blank or spills past the corners. A
        // TextureView draws like an ordinary view and clips correctly. It costs
        // a little performance, which for a route on a card is not a concern.
        androidView="texture"
        onDidFinishLoadingStyle={() => setStage((s) => (s === "failed" ? s : "styled"))}
        onDidFinishLoadingMap={() => setStage("ready")}
        onDidFailLoadingMap={() => setStage("failed")}
      >
        {/* Ordered by how much the camera actually knows. The last case used to
            be the only fallback, and a Camera with no centre sits at [0, 0] —
            open Atlantic. Before the first GPS fix that is what filled the
            screen, which read as "the map is broken" rather than "waiting for a
            position". */}
        {follow && last ? (
          <Camera center={last} zoom={16} duration={600} />
        ) : bounds ? (
          <Camera
            bounds={bounds}
            padding={{ top: 44, bottom: 44, left: 44, right: 44 }}
            duration={600}
          />
        ) : center ? (
          <Camera center={center} zoom={15} duration={600} />
        ) : (
          <Camera zoom={11} />
        )}

        {/* Not only while recording: standing on the map before starting is
            how you check it found you. */}
        <UserLocation />

        {points.length >= 2 ? (
          <GeoJSONSource id="route" data={line}>
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": colors.primary, "line-width": 5 }}
            />
          </GeoJSONSource>
        ) : null}

        {ends ? (
          <GeoJSONSource id="route-ends" data={ends}>
            <Layer
              id="route-end-dots"
              type="circle"
              paint={{
                "circle-radius": 6,
                "circle-color": colors.primary,
                "circle-stroke-width": 3,
                "circle-stroke-color": colors.white,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>

      {/* Says which step is stuck. "Loading" that never changes means the
          native view came up but the style request never returned; "styled"
          without "ready" means the style parsed and the tiles did not. */}
      {stage !== "ready" ? (
        <View style={styles.status} pointerEvents="none">
          <Text style={styles.statusText}>
            {stage === "failed"
              ? "Map failed to load"
              : stage === "styled"
                ? "Loading tiles…"
                : "Loading map…"}
          </Text>
        </View>
      ) : null}

      {onLocate ? (
        <Pressable
          style={styles.locate}
          onPress={onLocate}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on my location"
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="locate" size={20} color={colors.white} />
          )}
        </Pressable>
      ) : null}

      {/* Drawn here rather than left to the map's own attribution control,
          which can be panned out of view — and ODbL wants it visible. */}
      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>© OpenStreetMap</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  frame: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.cardDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  status: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  statusText: { color: colors.white, fontSize: 11, fontWeight: "600" },
  locate: {
    position: "absolute",
    right: 12,
    bottom: 26,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  attribution: {
    position: "absolute",
    right: 6,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  attributionText: { fontSize: 9, color: "#404652" },
}));
