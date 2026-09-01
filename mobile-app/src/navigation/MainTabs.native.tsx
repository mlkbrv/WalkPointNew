/**
 * The bottom bar — native build, swipeable.
 *
 * This is a *top*-tab navigator pinned to the bottom. `createBottomTabNavigator`
 * mounts one screen at a time with no pager underneath, so it cannot swipe at
 * all; the material top-tab navigator is the one React Navigation builds on
 * `react-native-pager-view`, which is what makes the gesture possible.
 * `tabBarPosition="bottom"` then puts its bar where a bottom bar belongs, the
 * indicator is hidden, and the rest is restyled to match the web variant.
 *
 * Native-only because pager-view has no web implementation — see `MainTabs.tsx`.
 */

import { StyleSheet } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import type { MainTabParamList } from "../types";
import { TABS } from "./tabs";

const Tab = createMaterialTopTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={({ route }) => {
        const spec = TABS.find((s) => s.name === route.name);
        return {
          swipeEnabled: true,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            // Without the inset the bar sits under the gesture indicator on a
            // phone with no home button.
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarItemStyle: { paddingVertical: 6 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.slate,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "700" as const,
            // Top tabs upper-case their labels by default; a bottom bar does not.
            textTransform: "none" as const,
          },
          // A sliding underline belongs to a top tab bar, not a bottom one.
          tabBarIndicatorStyle: { height: 0 },
          tabBarShowIcon: true,
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
