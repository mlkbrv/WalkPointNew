/**
 * Device-side notification plumbing.
 *
 * Kept apart from the React tree because two pieces of it must run before any
 * component mounts: the foreground presentation handler, and the Android
 * channel. Registering a channel late means the first notification of a fresh
 * install lands in Android's unnamed default channel, which the user cannot
 * configure and which ignores the app's sound and importance settings.
 *
 * Everything here is a no-op on web, where `expo-notifications` has no device
 * token to give and the inbox is the whole story.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { MainTabParamList } from "../types";

/** Android groups notifications by channel; this is the one the server's pushes use. */
export const ANDROID_CHANNEL_ID = "stride-default";

/**
 * A notification arriving while the app is open would otherwise be swallowed
 * silently. It is shown as a banner — the payload is a coin award or a
 * moderation result, both worth interrupting for — but without a sound, since
 * the user is already looking at the screen.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "STRIDE",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8140F3",
    });
  } catch {
    // A channel that cannot be created is not worth blocking startup over;
    // notifications still arrive on the platform default.
  }
}

/**
 * Where a notification should take the user.
 *
 * The server puts its `NotificationType` in the data payload. Tabs and stack
 * screens are reached differently — a tab has to be addressed through the `Main`
 * navigator — so the target says which it is rather than leaving the caller to
 * guess. An unrecognised type falls through to the inbox, which lists
 * everything, so a new server-side type can never produce a dead tap.
 */
export type NotificationTarget =
  | { kind: "tab"; name: keyof MainTabParamList }
  /** Only routes that take no parameters — a push carries no ids to fill them with. */
  | { kind: "screen"; name: "Wallet" | "SupportChat" };

export function routeForNotification(data: Record<string, unknown>): NotificationTarget {
  const type = typeof data.notification_type === "string" ? data.notification_type : "";

  switch (type) {
    case "coins_awarded":
      return { kind: "screen", name: "Wallet" };
    case "new_coupon":
      return { kind: "tab", name: "StoreTab" };
    case "support_reply":
      return { kind: "screen", name: "SupportChat" };
    case "moderation_result":
      // Partners work in the web console; in this app the row is all there is.
      return { kind: "tab", name: "InboxTab" };
    case "steps_missed":
      return { kind: "tab", name: "HomeTab" };
    default:
      return { kind: "tab", name: "InboxTab" };
  }
}
