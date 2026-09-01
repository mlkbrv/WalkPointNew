/**
 * What the five tabs are, shared by both implementations of the bar.
 *
 * The bar itself is split by platform (`MainTabs.native.tsx` / `MainTabs.tsx`),
 * because only the native one can swipe. This is everything that must stay
 * identical between them, so the two cannot drift into showing different tabs.
 */

import type { ComponentType } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { HomeScreen } from "../screens/HomeScreen";
import { TrackScreen } from "../screens/TrackScreen";
import { PerformanceReportsScreen } from "../screens/PerformanceReportsScreen";
import { StoreScreen } from "../screens/StoreScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import type { MainTabParamList } from "../types";
import type { Strings } from "../i18n/strings";

export interface TabSpec {
  name: keyof MainTabParamList;
  component: ComponentType<object>;
  titleKey: keyof Strings;
  on: keyof typeof Ionicons.glyphMap;
  off: keyof typeof Ionicons.glyphMap;
}

/**
 * Typed against the route list, so a tab added to `MainTabParamList` without an
 * entry here is a compile error rather than a blank icon nobody notices.
 */
export const TABS: TabSpec[] = [
  { name: "HomeTab", component: HomeScreen, titleKey: "tabHome", on: "home", off: "home-outline" },
  { name: "TrackTab", component: TrackScreen, titleKey: "tabTrack", on: "walk", off: "walk-outline" },
  {
    name: "ReportTab",
    component: PerformanceReportsScreen,
    titleKey: "tabReport",
    on: "bar-chart",
    off: "bar-chart-outline",
  },
  { name: "StoreTab", component: StoreScreen, titleKey: "tabStore", on: "bag", off: "bag-outline" },
  {
    name: "AccountTab",
    component: ProfileScreen,
    titleKey: "tabAccount",
    on: "person",
    off: "person-outline",
  },
];
