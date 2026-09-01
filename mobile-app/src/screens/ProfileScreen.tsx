import {
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radii, spacing, shadows } from "../theme";
import { PressableScale } from "../components/PressableScale";
import { Avatar } from "../components/Avatar";
import { GlassCard } from "../components/GlassCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { useStepoint } from "../contexts/StepointContext";
import { useAuth } from "../contexts/AuthContext";
import { makeStyles, useTheme, Appearance } from "../contexts/ThemeContext";
import { useI18n, type LanguagePreference } from "../contexts/I18nContext";
import { LANGUAGES, type LanguageCode } from "../i18n/strings";
import { SelectRow } from "../components/SelectRow";

export function ProfileScreen() {
  const { colors, preference, setPreference, scheme } = useTheme();
  const { t, preference: langPref, setPreference: setLangPref } = useI18n();
  const styles = useStyles();
  const navigation = useNavigation<{
    navigate: (s: string) => void;
    canGoBack: () => boolean;
    goBack: () => void;
    getParent?: () => { navigate: (s: string) => void } | undefined;
  }>();
  const insets = useSafeAreaInsets();
  const { user, prefs, updatePrefs, logout } = useAuth();
  const { userStats, setUserStats } = useStepoint();

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
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* No back button: this is a tab root, so there is nothing to go back to. */}
        <ScreenHeader title={t("account")} />

        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <Avatar uri={user?.avatar} name={user?.name} size={96} />
            <PressableScale style={styles.editBtn} onPress={() => navigation.navigate("EditProfile")}>
              <Ionicons name="create-outline" size={14} color={colors.white} />
            </PressableScale>
          </View>
          <Text style={styles.name}>{user?.name || "Walker"}</Text>
          <Text style={styles.meta}>
            {t("memberSince", { year: user?.memberSince || "2026" })}
          </Text>
        </View>

        <View style={styles.stats}>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>{t("weight")}</Text>
            <View style={styles.statEdit}>
              <PressableScale onPress={() => bump("weightKg", -1)}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
              <Text style={styles.statValue}>{userStats.weightKg} {t("kgUnit")}</Text>
              <PressableScale onPress={() => bump("weightKg", 1)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
            </View>
          </GlassCard>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>{t("height")}</Text>
            <View style={styles.statEdit}>
              <PressableScale onPress={() => bump("heightCm", -1)}>
                <Ionicons name="remove-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
              <Text style={styles.statValue}>{userStats.heightCm} {t("cmUnit")}</Text>
              <PressableScale onPress={() => bump("heightCm", 1)}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              </PressableScale>
            </View>
          </GlassCard>
          <GlassCard style={styles.statTile}>
            <Text style={styles.statLabel}>{t("goal")}</Text>
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

        {/* Inbox, Board and History are reached from here now: they gave up their
            tab slots to Report and Account. */}
        <Text style={styles.sectionLabel}>{t("activity")}</Text>
        <GlassCard style={styles.group}>
          <Row
            icon="notifications-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("notifications")}
            subtitle={t("notificationsSub")}
            onPress={() => navigation.navigate("Inbox")}
          />
          <View style={styles.divider} />
          <Row
            icon="time-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("history")}
            subtitle={t("historySub")}
            onPress={() => navigation.navigate("History")}
          />
          <View style={styles.divider} />
          <Row
            icon="medal-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("achievements")}
            subtitle={t("achievementsSub")}
            onPress={() => navigation.navigate("Achievements")}
          />
          <View style={styles.divider} />
          <Row
            icon="trophy-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("leaderboard")}
            subtitle={t("leaderboardSub")}
            onPress={() => navigation.navigate("Scoreboard")}
          />
        </GlassCard>

        <Text style={styles.sectionLabel}>{t("account")}</Text>
        <GlassCard style={styles.group}>
          <Row
            icon="phone-portrait-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("connectedDevices")}
            subtitle={t("connectedDevicesSub")}
            onPress={() => navigation.navigate("ConnectedDevices")}
          />
          <View style={styles.divider} />
          <Row
            icon="help-circle-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("helpSupport")}
            subtitle={t("helpSupportSub")}
            onPress={() => navigation.navigate("HelpSupport")}
          />
          <View style={styles.divider} />
          <Row
            icon="wallet-outline"
            iconColor={colors.coralInk}
            iconBg={colors.primaryTint}
            title={t("wallet")}
            subtitle={t("walletSub")}
            onPress={() => navigation.navigate("Wallet")}
          />
          <View style={styles.divider} />
          <Row
            icon="fitness-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("healthSetup")}
            subtitle={t("healthSetupSub")}
            onPress={() => navigation.navigate("HealthSetup")}
          />
        </GlassCard>

        <Text style={styles.sectionLabel}>{t("appearance")}</Text>
        <GlassCard style={styles.group}>
          <View style={styles.appearanceRow}>
            {["system", "light", "dark"].map((value) => {
              const labelMap: Record<string, string> = {
                system: t("auto"),
                light: t("light"),
                dark: t("dark"),
              };
              const iconMap: Record<string, string> = {
                system: "phone-portrait-outline",
                light: "sunny-outline",
                dark: "moon-outline",
              };
              const active = preference === value;
              return (
                <View key={value} style={styles.appearanceSlot}>
                  <PressableScale
                    style={[styles.appearanceOption, active && styles.appearanceOptionActive]}
                    onPress={() => setPreference(value as Appearance)}
                  >
                    <Ionicons
                      name={iconMap[value] as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={active ? colors.primary : colors.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.appearanceLabel,
                        active && styles.appearanceLabelActive,
                      ]}
                    >
                      {labelMap[value]}
                    </Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>
          {/* "Auto" is the default and what most people want; naming what it
            currently resolves to saves them opening the app twice to find out. */}
          <Text style={styles.appearanceHint}>
            {preference === "system"
              ? t("followingDevice", { scheme: scheme === "dark" ? t("dark") : t("light") })
              : t("alwaysTheme", {
                  theme: preference === "dark" ? t("dark") : t("light"),
                })}
          </Text>
        </GlassCard>

        <Text style={styles.sectionLabel}>{t("language")}</Text>
        <GlassCard style={styles.group}>
          {/* A list, not a row of pills: language names differ in length between
              translations, so pills sharing one line either overflow or squash
              each other the moment a longer name appears. */}
          <SelectRow
            title={t("language")}
            value={langPref}
            onChange={setLangPref}
            options={[
              { value: "system" as LanguagePreference, label: t("auto"), icon: "🌐" },
              ...(Object.keys(LANGUAGES) as LanguageCode[]).map((code) => ({
                value: code as LanguagePreference,
                label: LANGUAGES[code].label,
                icon: LANGUAGES[code].flag,
              })),
            ]}
          />
        </GlassCard>

        <Text style={styles.sectionLabel}>{t("preferences")}</Text>
        <GlassCard style={styles.group}>
          <ToggleRow
            icon="notifications-outline"
            iconColor={colors.primary}
            iconBg={colors.primaryTint}
            title={t("notifications")}
            subtitle={t("pushAlerts")}
            value={prefs.notificationsEnabled}
            onValueChange={(v) => updatePrefs({ notificationsEnabled: v })}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="eye-outline"
            iconColor={colors.coralInk}
            iconBg={colors.primaryTint}
            title={t("privacyVisible")}
            subtitle={t("privacyVisibleSub")}
            value={prefs.privacyVisible}
            onValueChange={(v) => updatePrefs({ privacyVisible: v })}
          />
        </GlassCard>

        <PressableScale
          style={styles.logout}
          onPress={async () => {
            await logout();
          }}
        >
          <Text style={styles.logoutText}>{t("logOut")}</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: 20, paddingBottom: spacing.xl, gap: 16 },
  hero: { alignItems: "center", gap: 10, marginBottom: spacing.xl },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.border,
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
    ...shadows.surface,
  },
  name: { fontSize: 22, fontWeight: "600", color: colors.charcoal },
  meta: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  stats: { flexDirection: "row", gap: 10 },
  // GlassCard already provides its own elevation now.
  statTile: { flex: 1, padding: 12, alignItems: "center", gap: 8 },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  statEdit: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontSize: 15, fontWeight: "600", color: colors.primary, minWidth: 48, textAlign: "center" },
  appearanceRow: { flexDirection: "row", gap: 8, padding: 12 },
  // The flex lives on `appearanceSlot`, never here: PressableScale styles its
  // inner Pressable and leaves its own wrapper unsized, so a flex passed in
  // measures against nothing and the pill shrinks to its text.
  appearanceSlot: { flex: 1 },
  appearanceOption: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appearanceOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  appearanceLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  appearanceLabelActive: { color: colors.primary },
  appearanceHint: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    fontSize: 13,
    lineHeight: 16,
    color: colors.muted,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
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
  rowTitle: { fontSize: 13, fontWeight: "600", color: colors.charcoal },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
  logout: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    ...shadows.card,
  },
  logoutText: {
    color: colors.coralInk,
    fontSize: 15,
    fontWeight: "600",
  },
}));