import { makeStyles } from "../contexts/ThemeContext";
/**
 * A person's avatar.
 *
 * The app previously defaulted to a hard-coded Unsplash URL — the same
 * photograph of an unrelated real person shown as six different users' faces,
 * fetched over the network every time and blank when offline. This draws
 * initials on a colour derived from the name instead: no network, no stranger,
 * and two different people reliably look different.
 *
 * A real uploaded photo still wins when there is one; the initials are the
 * fallback, not a replacement.
 */

import { useState } from "react";
import { Image, Text, View, type ImageStyle } from "react-native";

import { mediaUrl } from "../api/client";



/**
 * Background tints, all dark enough to carry white text at 4.5:1 or better.
 * Picked by hashing the name so a given person keeps the same colour across
 * screens and sessions.
 */
const TINTS = [
  // Deliberately no violet here: that is the brand colour, and an initials
  // disc in it reads as app chrome rather than as a person.
  "#0F766E", // teal
  "#0E7490", // cyan
  "#B45309", // amber
  "#15803D", // green
  "#BE185D", // pink
  "#1D4ED8", // blue
  "#B91C1C", // red
  "#4D7C0F", // lime
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

export function Avatar({
  uri,
  name,
  size = 40,
  style,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ImageStyle;
}) {
  const styles = useStyles();
  // A broken image URL would otherwise leave a blank square with no fallback.
  const [failed, setFailed] = useState(false);
  const label = name?.trim() || "";

  const shape = { width: size, height: size, borderRadius: size / 2 };

  // Resolved here rather than at each call site: the API hands back a storage
  // key, and every screen that showed a face was passing it to Image raw.
  const source = mediaUrl(uri);

  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={[shape, style] as ImageStyle[]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[shape, styles.fallback, { backgroundColor: tintFor(label) }, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]} numberOfLines={1}>
        {initials(label)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { color: colors.white, fontWeight: "600", letterSpacing: 0.5 },
}));
