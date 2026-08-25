import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { useStride } from "../contexts/StrideContext";
import { useAuth } from "../contexts/AuthContext";
import { useHealth } from "../contexts/HealthContext";

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, prefs, updatePrefs, switchRole, logout } = useAuth();
  const { userStats, setUserStats, togglePermissions, triggerMockStepsBoost } = useStride();
  const health = useHealth();

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else {
      const parent = navigation.getParent?.();
      if (parent) parent.navigate("HomeTab");
    }
  };

  const bump = (key: "weightKg" | "heightCm" | "stepsGoal", delta: number) => {
    setUserStats((prev) => ({
      ...prev,
      [key]: Math.max(key === "stepsGoal" ? 1000 : 1, prev[key] + delta),
    }));
  };

  const Row = ({
    icon,
    iconColor,
    iconBg,
    title,
    subtitle,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <PressableScale style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </PressableScale>
  );

  const ToggleRow = ({
    icon,
    iconColor,
    iconBg,
    title,
    subtitle,
    value,
    onValueChange,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
  }) => (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.emerald }}
        thumbColor={colors.white}
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Profile" onBack={goBack} />

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Image
              source={{
                uri:
                  user?.avatar ||
                  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
              }}
              style={styles.avatar}
            />
            <PressableScale style={styles.editBtn} onPress={() => navigation.navigate("EditProfile")}>
              <Ionicons name="create-outline" size={14} color={colors.white} />
            </PressableScale>
          </View>
          <Text style={styles.name}>{user?.name || "Walker"}</Text>
          <Text style={styles.meta}>
            {user?.role === "merchant" ? "Merchant" : "Active Member"} since {user?.memberSince || "2026"}
          </Text>
        </View>

        <View style={styles.stats}>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>Weight</Text>
            <View style={styles.statEdit}>
              <PressableScale onPress={() => bump("weightKg", -1)}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
              <Text style={styles.statValue}>{userStats.weightKg} kg</Text>
              <PressableScale onPress={() => bump("weightKg", 1)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
            </View>
          </GlassCard>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>Height</Text>
            <View style={styles.statEdit}>
              <PressableScale onPress={() => bump("heightCm", -1)}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
              <Text style={styles.statValue}>{userStats.heightCm} cm</Text>
              <PressableScale onPress={() => bump("heightCm", 1)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
            </View>
          </GlassCard>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>Goal</Text>
            <View style={styles.statEdit}>
              <PressableScale onPress={() => bump("stepsGoal", -500)}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
              <Text style={styles.statValue}>{(userStats.stepsGoal / 1000).toFixed(0)}k</Text>
              <PressableScale onPress={() => bump("stepsGoal", 500)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
            </View>
          </GlassCard>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <GlassCard style={styles.group}>
          <Row
            icon="phone-portrait-outline"
            iconColor={colors.primary}
            iconBg="rgba(129,64,243,0.12)"
            title="Connected Devices"
            subtitle="Apple Health and Google Fit sync"
            onPress={() => navigation.navigate("ConnectedDevices")}
          />
          <View style={styles.divider} />
          <Row
            icon="help-circle-outline"
            iconColor={colors.emerald}
            iconBg="rgba(0,225,148,0.12)"
            title="Help & Support"
            subtitle="FAQs and member helpdesk"
            onPress={() => navigation.navigate("HelpSupport")}
          />
          <View style={styles.divider} />
          <Row
            icon="wallet-outline"
            iconColor={colors.coral}
            iconBg="rgba(255,107,82,0.12)"
            title="Wallet"
            subtitle="Your redeemed coupons"
            onPress={() => navigation.navigate("Wallet")}
          />
          <View style={styles.divider} />
          <Row
            icon="fitness-outline"
            iconColor={colors.primary}
            iconBg="rgba(129,64,243,0.12)"
            title="Health Setup"
            subtitle="Pedometer permissions and mock mode"
            onPress={() => navigation.navigate("HealthSetup")}
          />
        </GlassCard>

        <Text style={styles.sectionLabel}>Role</Text>
        <GlassCard style={styles.roleCard}>
          <PressableScale
            style={[styles.roleBtn, user?.role === "consumer" && styles.roleBtnActive]}
            onPress={() => switchRole("consumer")}
          >
            <Text style={[styles.roleText, user?.role === "consumer" && styles.roleTextActive]}>
              Consumer
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.roleBtn, user?.role === "merchant" && styles.roleBtnActive]}
            onPress={() => switchRole("merchant")}
          >
            <Text style={[styles.roleText, user?.role === "merchant" && styles.roleTextActive]}>
              Merchant
            </Text>
          </PressableScale>
        </GlassCard>

        {user?.role === "merchant" ? (
          <>
            <Text style={styles.sectionLabel}>Merchant</Text>
            <GlassCard style={styles.group}>
              <Row
                icon="ticket-outline"
                iconColor={colors.primary}
                iconBg="rgba(129,64,243,0.12)"
                title="Create Coupon"
                subtitle="Publish a new store reward"
                onPress={() => navigation.navigate("CreateCoupon")}
              />
              <View style={styles.divider} />
              <Row
                icon="storefront-outline"
                iconColor={colors.emerald}
                iconBg="rgba(0,225,148,0.12)"
                title="Merchant Manager"
                subtitle="Manage listings and redemptions"
                onPress={() => navigation.navigate("MerchantManager")}
              />
            </GlassCard>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Preferences</Text>
        <GlassCard style={styles.group}>
          <ToggleRow
            icon="notifications-outline"
            iconColor={colors.primary}
            iconBg="rgba(129,64,243,0.12)"
            title="Notifications"
            subtitle="Push alerts and milestones"
            value={prefs.notificationsEnabled}
            onValueChange={(v) => updatePrefs({ notificationsEnabled: v })}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="eye-outline"
            iconColor={colors.coral}
            iconBg="rgba(255,107,82,0.12)"
            title="Privacy Visible"
            subtitle="Show profile on scoreboard"
            value={prefs.privacyVisible}
            onValueChange={(v) => updatePrefs({ privacyVisible: v })}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="walk-outline"
            iconColor={colors.emerald}
            iconBg="rgba(0,225,148,0.12)"
            title="Pedometer Active"
            subtitle="Live step tracking"
            value={userStats.pedometerActive}
            onValueChange={() => togglePermissions()}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="code-slash-outline"
            iconColor={colors.primary}
            iconBg="rgba(129,64,243,0.12)"
            title="Developer Mock Mode"
            subtitle={health.mockMode ? "Simulated steps & balance ON" : "Real Health Sync only"}
            value={health.mockMode}
            onValueChange={(v) => health.setMockMode(v)}
          />
        </GlassCard>

        {health.mockMode ? (
          <>
            <Text style={styles.sectionLabel}>Mock Tools</Text>
            <GlassCard style={styles.group}>
              <View style={styles.mockRow}>
                <PressableScale style={styles.mockBtn} onPress={() => triggerMockStepsBoost(1000)}>
                  <Text style={styles.mockBtnText}>+1,000 Steps</Text>
                </PressableScale>
                <PressableScale style={styles.mockBtn} onPress={() => triggerMockStepsBoost(5000)}>
                  <Text style={styles.mockBtnText}>+5,000 Steps</Text>
                </PressableScale>
              </View>
              <Text style={styles.mockHint}>
                Coins follow the server rule: nothing under 5,000 steps, 50 at 5,000,
                then +10 per extra 1,000. Use this to test Store purchases.
              </Text>
            </GlassCard>
          </>
        ) : null}

        <PressableScale
          style={styles.logout}
          onPress={async () => {
            await logout();
          }}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  hero: { alignItems: "center", gap: 10, marginBottom: 8 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "rgba(129,64,243,0.2)",
  },
  editBtn: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  name: { fontSize: 20, fontWeight: "900", color: colors.charcoal },
  meta: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stats: { flexDirection: "row", gap: 10 },
  statTile: { flex: 1, padding: 12, alignItems: "center", gap: 8 },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontSize: 13, fontWeight: "900", color: colors.primary, minWidth: 48, textAlign: "center" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  group: { overflow: "hidden", paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 12, fontWeight: "700", color: colors.charcoal },
  rowSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
  roleCard: { flexDirection: "row", padding: 6, gap: 6 },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.lg,
    alignItems: "center",
    backgroundColor: colors.canvas,
  },
  roleBtnActive: { backgroundColor: colors.primary },
  roleText: { fontSize: 12, fontWeight: "800", color: colors.slate },
  roleTextActive: { color: colors.white },
  logout: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignItems: "center",
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  mockRow: { flexDirection: "row", gap: 10, padding: 12 },
  mockBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  mockBtnText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  mockHint: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
});
