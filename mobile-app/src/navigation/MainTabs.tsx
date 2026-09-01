/**
 * The bottom bar — web build.
 *
 * Plain bottom tabs, no swipe. The swipeable version lives in
 * `MainTabs.native.tsx`: it is built on `react-native-pager-view`, which ships
 * no web implementation at all — no `.web.js`, no `browser` field — so using it
 * here renders no tab bar whatsoever rather than degrading to taps.
 */

import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import type { MainTabParamList } from "../types";
import { TABS } from "./tabs";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const spec = TABS.find((s) => s.name === route.name);
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.slate,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "700" as const },
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) =>
            spec ? (
              <Ionicons name={focused ? spec.on : spec.off} size={22} color={color} />
            ) : null,
        };
      }}
    >
      {TABS.map((spec) => (
        <Tab.Screen
          key={spec.name}
          name={spec.name}
          component={spec.component}
          options={{ title: t(spec.titleKey) }}
        />
      ))}
    </Tab.Navigator>
  );
}
