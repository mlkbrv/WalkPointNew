/**
 * Reacting to notifications that arrive or are tapped.
 *
 * Two separate things happen to a push, and conflating them is the usual bug:
 *
 * * **Received** — the app is open. Nothing navigates; the inbox and the tab
 *   badge are refreshed so the new row appears where the user would look for it.
 * * **Tapped** — the user chose to act. Now we navigate, and only now.
 *
 * The tap listener also has to cover a cold start: if the app was killed, the
 * notification that launched it is not delivered through the listener at all,
 * it is waiting in `getLastNotificationResponseAsync`. Missing that case is why
 * "tapping the notification just opens the home screen" happens.
 */

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import type { NavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";

import { useServerData } from "../contexts/ServerDataContext";
import { configureNotificationChannel, routeForNotification } from "../notifications/setup";
import type { RootStackParamList } from "../types";

type Navigator = NavigationContainerRef<RootStackParamList>;

export function useNotificationHandlers(navigationRef: React.RefObject<Navigator | null>): void {
  const { refreshInbox, refreshWallet } = useServerData();
  /** A cold-start tap must be consumed once, not on every remount. */
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let disposed = false;

    void configureNotificationChannel();

    const navigate = (data: Record<string, unknown>) => {
      const target = routeForNotification(data);
      const nav = navigationRef.current;
      if (!nav?.isReady()) return;

      if (target.kind === "tab") {
        nav.navigate("Main", { screen: target.name });
        return;
      }
      // Spelled out rather than passed through: `navigate` is overloaded per
      // route, so a union of names does not satisfy any single overload.
      switch (target.name) {
        case "Wallet":
          nav.navigate("Wallet");
          break;
        case "SupportChat":
          nav.navigate("SupportChat");
          break;
        case "MerchantManager":
          nav.navigate("MerchantManager");
          break;
      }
    };

    const received = Notifications.addNotificationReceivedListener(() => {
      // The push carries a copy of a row the server already stored; re-read it
      // rather than reconstructing the row from the payload.
      void refreshInbox();
      void refreshWallet();
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      navigate(response.notification.request.content.data ?? {});
      void refreshInbox();
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (disposed || handledColdStart.current || !response) return;
      handledColdStart.current = true;
      // The navigator may still be mounting on a cold start.
      setTimeout(() => navigate(response.notification.request.content.data ?? {}), 400);
    });

    return () => {
      disposed = true;
      received.remove();
      responded.remove();
    };
  }, [navigationRef, refreshInbox, refreshWallet]);
}
