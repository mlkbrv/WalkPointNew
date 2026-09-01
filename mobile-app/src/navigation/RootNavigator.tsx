import React, { useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import { useNotificationHandlers } from "../hooks/useNotificationHandlers";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { AuthStackParamList, RootStackParamList } from "../types";
import { MainTabs } from "./MainTabs";
import { FeedbackToast } from "../components/FeedbackToast";
import { useOnboarding } from "../hooks/useOnboarding";

import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { InboxScreen } from "../screens/InboxScreen";
import { ScoreboardScreen } from "../screens/ScoreboardScreen";
import { ConnectedDevicesScreen } from "../screens/ConnectedDevicesScreen";
import { HelpSupportScreen } from "../screens/HelpSupportScreen";
import { SupportChatScreen } from "../screens/SupportChatScreen";
import { BrandStoreScreen } from "../screens/BrandStoreScreen";
import { CouponDetailScreen } from "../screens/CouponDetailScreen";
import { SecureVerificationScreen } from "../screens/SecureVerificationScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { GoalReachedScreen } from "../screens/GoalReachedScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { HealthSetupScreen } from "../screens/HealthSetupScreen";
import { StoriesScreen } from "../screens/StoriesScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AchievementsScreen } from "../screens/AchievementsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
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

function AppStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        statusBarHidden: true,
        navigationBarHidden: true,
        // iOS: swiping back is how people leave a screen there, and with the
        // header hidden there is no back chevron to fall back on. The
        // full-screen variant means the gesture starts anywhere, not only in
        // the few pixels at the left edge.
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen name="Account" component={ProfileScreen} />
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
