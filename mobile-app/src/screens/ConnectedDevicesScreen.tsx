import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStride } from "../contexts/StrideContext";
import { radii, spacing } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { makeStyles, useTheme } from "../contexts/ThemeContext";

export function ConnectedDevicesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const { devices, toggleDevice, syncDevice } = useStride();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const onSync = async (id: string) => {
    setSyncingId(id);
    await syncDevice(id);
    setSyncingId(null);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Connected Devices" onBack={() => navigation.goBack()} />

        <Text style={styles.sub}>Sync pedometers and wearable sources to keep your step balance accurate.</Text>

        {devices.map((device) => (
          <GlassCard key={device.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={device.id === "fitbit" ? "watch-outline" : "phone-portrait-outline"}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.meta}>
                <Text style={styles.name}>{device.name}</Text>
                <Text style={styles.status}>
                  {device.connected ? `Connected • ${device.lastSync || "Just now"}` : "Disconnected"}
                </Text>
              </View>
              <Switch
                value={device.connected}
                onValueChange={() => toggleDevice(device.id)}
                trackColor={{ false: "#CBD5E1", true: colors.emeraldInk }}
                thumbColor={colors.white}
              />
            </View>

            <PressableScale
              style={styles.syncBtn}
              onPress={() => onSync(device.id)}
              disabled={syncingId === device.id}
            >
              {syncingId === device.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={colors.primary} />
                  <Text style={styles.syncText}>Sync now</Text>
                </>
              )}
            </PressableScale>
          </GlassCard>
        ))}

        <PressableScale style={styles.guideBtn} onPress={() => navigation.navigate("HealthSetup")}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
          <Text style={styles.guideText}>Health Connect Guidance</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: 56, paddingBottom: 40 },
  sub: { color: colors.slate, fontSize: 13, lineHeight: 18, marginBottom: spacing.lg, marginTop: -4 },
  card: { padding: 16, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1 },
  name: { color: colors.charcoal, fontWeight: "600", fontSize: 15 },
  status: { color: colors.muted, fontSize: 13, marginTop: 2 },
  syncBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    borderRadius: radii.full,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: `${colors.primary}0F`,
  },
  syncText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  guideBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  guideText: { color: colors.white, fontWeight: "600", fontSize: 15 },
}));
