import React, { useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useNotificationHandlers } from "../hooks/useNotificationHandlers";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { AuthStackParamList, MainTabParamList, RootStackParamList } from "../types";
import { FeedbackToast } from "../components/FeedbackToast";
import { useOnboarding } from "../hooks/useOnboarding";

import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { TrackScreen } from "../screens/TrackScreen";
import { InboxScreen } from "../screens/InboxScreen";
import { ScoreboardScreen } from "../screens/ScoreboardScreen";
import { StoreScreen } from "../screens/StoreScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ConnectedDevicesScreen } from "../screens/ConnectedDevicesScreen";
import { HelpSupportScreen } from "../screens/HelpSupportScreen";
import { SupportChatScreen } from "../screens/SupportChatScreen";
import { BrandStoreScreen } from "../screens/BrandStoreScreen";
import { CouponDetailScreen } from "../screens/CouponDetailScreen";
import { SecureVerificationScreen } from "../screens/SecureVerificationScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { GoalReachedScreen } from "../screens/GoalReachedScreen";
import { PerformanceReportsScreen } from "../screens/PerformanceReportsScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { HealthSetupScreen } from "../screens/HealthSetupScreen";
import { StoriesScreen } from "../screens/StoriesScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "fade",
        statusBarHidden: true,
        navigationBarHidden: true,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

/**
 * Typed as a total map over the tab routes on purpose. The lookup below cannot
 * fail at runtime — an unlisted tab would have rendered `<Ionicons
 * name={undefined}>`, which draws a blank square and reports nothing — so a
 * missing entry has to be a compile error instead.
 */
const TAB_ICON: Record<
  keyof MainTabParamList,
  { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }
> = {
  HomeTab: { on: "home", off: "home-outline" },
  TrackTab: { on: "walk", off: "walk-outline" },
  ReportTab: { on: "bar-chart", off: "bar-chart-outline" },
  StoreTab: { on: "bag", off: "bag-outline" },
  AccountTab: { on: "person", off: "person-outline" },
};

function MainTabs() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "rgba(22,26,33,0.97)" : "rgba(255,255,255,0.96)",
          borderTopColor: colors.border,
          // Without the inset the bar sits under the gesture indicator on a
          // phone with no home button, and the last row of every tab is
          // unreachable behind it.
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarIcon: ({ color, size, focused }) => {
          const icon = TAB_ICON[route.name as keyof MainTabParamList];
          return <Ionicons name={focused ? icon.on : icon.off} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="TrackTab" component={TrackScreen} options={{ title: "Track" }} />
      <Tab.Screen
        name="ReportTab"
        component={PerformanceReportsScreen}
        options={{ title: "Report" }}
      />
      <Tab.Screen name="StoreTab" component={StoreScreen} options={{ title: "Store" }} />
      <Tab.Screen name="AccountTab" component={ProfileScreen} options={{ title: "Account" }} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        statusBarHidden: true,
        navigationBarHidden: true,
      }}
    >
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen name="Inbox" component={InboxScreen} />
      <RootStack.Screen name="Scoreboard" component={ScoreboardScreen} />
      <RootStack.Screen name="Achievements" component={AchievementsScreen} />
      <RootStack.Screen name="History" component={HistoryScreen} />
      <RootStack.Screen name="ConnectedDevices" component={ConnectedDevicesScreen} />
      <RootStack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <RootStack.Screen name="SupportChat" component={SupportChatScreen} />
      <RootStack.Screen name="BrandStore" component={BrandStoreScreen} />
      <RootStack.Screen
        name="Stories"
        component={StoriesScreen}
        options={{ animation: "fade", presentation: "fullScreenModal" }}
      />
      <RootStack.Screen name="CouponDetail" component={CouponDetailScreen} />
      <RootStack.Screen name="SecureVerification" component={SecureVerificationScreen} />
      <RootStack.Screen name="Wallet" component={WalletScreen} />
      <RootStack.Screen name="GoalReached" component={GoalReachedScreen} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
      <RootStack.Screen name="HealthSetup" component={HealthSetupScreen} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  // Notification taps arrive outside the React tree, so they need a handle on
  // the navigator rather than a `useNavigation` inside some screen.
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const { onboarded, complete } = useOnboarding();

  useNotificationHandlers(navigationRef);

  // `onboarded` is undefined until storage has been read. Waiting on it as well
  // as on auth is what stops the intake questions flashing up for a moment on
  // every cold start for someone who finished them months ago.
  if (loading || onboarded === undefined) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.canvas,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <View style={styles.flex}>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {!user ? (
          <AuthNavigator />
        ) : !onboarded ? (
          // Outside any navigator: it owns the whole screen, has its own back
          // handling between steps, and there is nowhere else to go from it.
          <OnboardingScreen onDone={complete} />
        ) : (
          <AppStack />
        )}
      </NavigationContainer>
      {user ? <FeedbackToast /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1 },
  boot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
}));
