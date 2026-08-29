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
import { useAuth } from "../contexts/AuthContext";
import { useServerData } from "../contexts/ServerDataContext";
import { useNotificationHandlers } from "../hooks/useNotificationHandlers";
import { makeStyles, useTheme } from "../contexts/ThemeContext";
import { AuthStackParamList, MainTabParamList, RootStackParamList } from "../types";
import { FeedbackToast } from "../components/FeedbackToast";
import { HealthConnectWall } from "../components/HealthConnectWall";
import { useHealth } from "../contexts/HealthContext";

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
import { WorkoutSummaryScreen } from "../screens/WorkoutSummaryScreen";
import { PerformanceReportsScreen } from "../screens/PerformanceReportsScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { HealthSetupScreen } from "../screens/HealthSetupScreen";
import { CreateCouponScreen } from "../screens/CreateCouponScreen";
import { MerchantManagerScreen } from "../screens/MerchantManagerScreen";
import { MerchantScannerScreen } from "../screens/MerchantScannerScreen";
import { StoriesScreen } from "../screens/StoriesScreen";

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

function MainTabs() {
  // The badge counts what the server says is unread, so it matches the inbox
  // even when a notification was read on another device.
  const { unreadCount: unread } = useServerData();
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "rgba(22,26,33,0.97)" : "rgba(255,255,255,0.96)",
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            HomeTab: focused ? "home" : "home-outline",
            TrackTab: focused ? "compass" : "compass-outline",
            InboxTab: focused ? "notifications" : "notifications-outline",
            ScoreboardTab: focused ? "trophy" : "trophy-outline",
            StoreTab: focused ? "bag" : "bag-outline",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen name="TrackTab" component={TrackScreen} options={{ title: "Track" }} />
      <Tab.Screen
        name="InboxTab"
        component={InboxScreen}
        options={{
          title: "Inbox",
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.coralInk, fontSize: 10 },
        }}
      />
      <Tab.Screen name="ScoreboardTab" component={ScoreboardScreen} options={{ title: "Board" }} />
      <Tab.Screen name="StoreTab" component={StoreScreen} options={{ title: "Store" }} />
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
      <RootStack.Screen name="Profile" component={ProfileScreen} />
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
      <RootStack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} />
      <RootStack.Screen name="PerformanceReport" component={PerformanceReportsScreen} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
      <RootStack.Screen name="HealthSetup" component={HealthSetupScreen} />
      <RootStack.Screen name="CreateCoupon" component={CreateCouponScreen} />
      <RootStack.Screen name="MerchantManager" component={MerchantManagerScreen} />
      <RootStack.Screen name="MerchantScanner" component={MerchantScannerScreen} />
    </RootStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();
  const health = useHealth();
  // Notification taps arrive outside the React tree, so they need a handle on
  // the navigator rather than a `useNavigation` inside some screen.
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const { colors, isDark } = useTheme();
  const styles = useStyles();

  useNotificationHandlers(navigationRef);

  if (loading || (user && !health.hydrated)) {
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
        {user ? <AppStack /> : <AuthNavigator />}
      </NavigationContainer>
      {user ? <FeedbackToast /> : null}
      {user ? <HealthConnectWall /> : null}
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
