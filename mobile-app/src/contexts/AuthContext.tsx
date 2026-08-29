/**
 * Session state, backed by the API.
 *
 * The public surface is unchanged from the mock version so screens did not have
 * to be rewritten: `login`, `register`, `logout` and friends still resolve to
 * `{ ok, error }` rather than throwing, because that is what the auth screens
 * already render.
 *
 * Preferences stay local. There is no preferences endpoint yet, and they only
 * affect this device's UI, so shipping them to the server would be inventing a
 * contract the API does not have.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, describeError, setSessionLostHandler } from "../api/client";
import { authApi, type ApiUser } from "../api/endpoints";
import { clearTokens, getRefreshToken, hydrateTokens, saveTokens } from "../api/tokens";
import { AuthUser, UserPreferences, UserRole } from "../types";

const PREFS_KEY = "@stride/user_prefs";

const defaultPrefs: UserPreferences = {
  notificationsEnabled: true,
  privacyVisible: true,
  emailAlerts: true,
  marketingPush: false,
};

/** The API's user shape is not the app's; this is the single translation point. */
function toAuthUser(apiUser: ApiUser): AuthUser {
  return {
    id: apiUser.id,
    name: apiUser.full_name || apiUser.email?.split("@")[0] || "Walker",
    email: apiUser.email ?? apiUser.phone ?? "",
    // No stock photo stand-in: `Avatar` draws initials when this is empty.
    avatar: apiUser.avatar_path ?? "",
    // The API's "partner" is the app's "merchant"; everything else is a consumer.
    role: apiUser.role === "partner" ? "merchant" : "consumer",
    memberSince: String(new Date().getFullYear()),
  };
}

type Result = { ok: boolean; error?: string };

type AuthContextValue = {
  user: AuthUser | null;
  prefs: UserPreferences;
  loading: boolean;
  login: (email: string, password: string) => Promise<Result>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    businessName?: string,
  ) => Promise<Result>;
  requestSmsCode: (phone: string) => Promise<Result>;
  verifySmsCode: (phone: string, code: string) => Promise<Result>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ ok: boolean; message: string }>;
  updateProfile: (patch: Partial<AuthUser>) => Promise<void>;
  updatePrefs: (patch: Partial<UserPreferences>) => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);

  const endSession = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  useEffect(() => {
    // Fired by the client when a refresh fails and the session cannot be recovered.
    setSessionLostHandler(() => {
      void endSession();
    });
  }, [endSession]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [, rawPrefs] = await Promise.all([hydrateTokens(), AsyncStorage.getItem(PREFS_KEY)]);
        if (rawPrefs && !cancelled) setPrefs({ ...defaultPrefs, ...JSON.parse(rawPrefs) });

        if (!getRefreshToken()) return;

        const apiUser = await authApi.me();
        if (!cancelled) setUser(toAuthUser(apiUser));
      } catch (caught) {
        // A stored session that the server rejects is over; a network blip is not.
        if (caught instanceof ApiError && caught.status === 401) await endSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const persistPrefs = useCallback(async (next: UserPreferences) => {
    setPrefs(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }, []);

  const adopt = useCallback(async (response: Awaited<ReturnType<typeof authApi.login>>) => {
    await saveTokens(response.tokens.access_token, response.tokens.refresh_token);
    setUser(toAuthUser(response.user));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<Result> => {
      if (!email.trim() || !password) {
        return { ok: false, error: "Email and password are required." };
      }
      try {
        await adopt(await authApi.login(email.trim().toLowerCase(), password));
        return { ok: true };
      } catch (caught) {
        return { ok: false, error: describeError(caught) };
      }
    },
    [adopt],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: UserRole): Promise<Result> => {
      if (!name.trim() || !email.trim() || !password) {
        return { ok: false, error: "All fields are required." };
      }
      if (password.length < 8) {
        return { ok: false, error: "Password must be at least 8 characters." };
      }
      if (role === "merchant") {
        // Businesses are onboarded and approved through the partner console.
        return { ok: false, error: "Business accounts are created in the partner web console." };
      }
      try {
        await adopt(
          await authApi.register(email.trim().toLowerCase(), password, name.trim()),
        );
        return { ok: true };
      } catch (caught) {
        return { ok: false, error: describeError(caught) };
      }
    },
    [adopt],
  );

  const requestSmsCode = useCallback(async (phone: string): Promise<Result> => {
    if (!phone.trim()) return { ok: false, error: "Enter your phone number." };
    try {
      await authApi.requestSms(phone.trim());
      return { ok: true };
    } catch (caught) {
      return { ok: false, error: describeError(caught) };
    }
  }, []);

  const verifySmsCode = useCallback(
    async (phone: string, code: string): Promise<Result> => {
      if (!code.trim()) return { ok: false, error: "Enter the code we sent you." };
      try {
        await adopt(await authApi.verifySms(phone.trim(), code.trim()));
        return { ok: true };
      } catch (caught) {
        return { ok: false, error: describeError(caught) };
      }
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    // Best-effort revoke; sign out locally whatever the server says.
    if (refresh) await authApi.logout(refresh).catch(() => undefined);
    await endSession();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [endSession]);

  const resetPassword = useCallback(async (email: string) => {
    if (!email.trim()) return { ok: false, message: "Enter your account email." };
    // No password-reset endpoint exists yet; say so rather than pretending.
    return {
      ok: false,
      message: "Password reset is not available yet. Sign in with your phone number instead.",
    };
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>) => {
      // Local-only until the profile endpoint lands; keeps the edit screen usable.
      setUser((current) => (current ? { ...current, ...patch } : current));
    },
    [],
  );

  const updatePrefs = useCallback(
    async (patch: Partial<UserPreferences>) => {
      await persistPrefs({ ...prefs, ...patch });
    },
    [prefs, persistPrefs],
  );

  const switchRole = useCallback(async (_role: UserRole) => {
    // Roles come from the server now; a client cannot promote itself.
  }, []);

  const value = useMemo(
    () => ({
      user,
      prefs,
      loading,
      login,
      register,
      requestSmsCode,
      verifySmsCode,
      logout,
      resetPassword,
      updateProfile,
      updatePrefs,
      switchRole,
    }),
    [
      user,
      prefs,
      loading,
      login,
      register,
      requestSmsCode,
      verifySmsCode,
      logout,
      resetPassword,
      updateProfile,
      updatePrefs,
      switchRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
