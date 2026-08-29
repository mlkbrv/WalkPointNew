import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { StoryGroup } from "../contexts/ServerDataContext";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

import { PressableScale } from "./PressableScale";

type Props = {
  stories: StoryGroup[];
  /** Partner ids whose frames the user has already watched this session. */
  seenIds: string[];
  onOpen: (partnerId: string) => void;
};

export function StoriesRail({ stories, seenIds, onOpen }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.title}>Nearby stories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {stories.map((story) => {
          const seen = seenIds.includes(story.partnerId);
          return (
            <PressableScale
              key={story.partnerId}
              style={styles.item}
              onPress={() => onOpen(story.partnerId)}
            >
              <LinearGradient
                colors={seen ? ["#D4D7DE", "#D4D7DE"] : [colors.primary, colors.coral, "#F5C451"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ring}
              >
                <View style={styles.inner}>
                  <Image source={{ uri: story.logo ?? undefined }} style={styles.logo} />
                </View>
              </LinearGradient>
              <Text style={styles.name} numberOfLines={1}>
                {story.partnerName}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.slate,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  row: { gap: 14, paddingRight: 8 },
  item: { width: 72, alignItems: "center", gap: 6 },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 60, height: 60 },
  name: { fontSize: 10, fontWeight: "700", color: colors.charcoal, width: 72, textAlign: "center" },
}));
