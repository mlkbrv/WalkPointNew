/**
 * Registers this device's push token with the server, and clears it on sign-out.
 *
 * The token is re-sent on every launch on purpose: FCM rotates tokens after a
 * reinstall or a restore, and a stale registration is a notification that silently
 * goes nowhere. Re-registering the same `device_id` updates it in place, and the
 * server detaches the token from any other account that previously claimed it.
 *
 * A failure here is logged and dropped: push is a nudge on top of the in-app
 * inbox, so nothing the user can see should break because a token did not save.
 */

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { inboxApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";

/** Stable per install; `installationId` survives app restarts but not a reinstall. */
function deviceId(): string {
  const anyConstants = Constants as unknown as { installationId?: string; sessionId?: string };
  return anyConstants.installationId ?? anyConstants.sessionId ?? "unknown-device";
}

/**
 * Obtains the FCM/APNs token. Returns null when push is unavailable — the web
 * build, a simulator, or a user who declined the permission.
 */
async function obtainPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token?.data === "string" ? token.data : null;
  } catch {
    // A simulator, or a device that cannot register with FCM/APNs.
    return null;
  }
}

export function usePushRegistration(): void {
  const { user } = useAuth();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      // Stop pushing to this device once nobody is signed in on it.
      if (registeredFor.current) {
        void inboxApi.revokePushToken(deviceId()).catch(() => undefined);
        registeredFor.current = null;
      }
      return;
    }

    if (registeredFor.current === user.id) return;

    (async () => {
      const token = await obtainPushToken();
      if (cancelled || !token) return;

      try {
        await inboxApi.registerPushToken(deviceId(), token, Platform.OS);
        registeredFor.current = user.id;
      } catch {
        // Best effort — the inbox still receives everything.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}
