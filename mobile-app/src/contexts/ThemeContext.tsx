/**
 * Light and dark appearance.
 *
 * The hard part of theming React Native is that `StyleSheet.create` runs once at
 * module load, so any colour inside it is frozen at import time — a screen
 * written the usual way cannot change appearance at all. `makeStyles` is the
 * fix: it takes the same object but as a function of the palette, and returns a
 * hook that builds (and caches) one stylesheet per palette. Two palettes means
 * at most two stylesheets per screen, built once each.
 *
 * The preference is three-valued, not a boolean. "System" is the default and the
 * one most people want; a forced choice is for the people who want it. Storing a
 * boolean would silently convert "follow my phone" into whatever the phone
 * happened to be on the day the switch was flipped.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { darkColors, lightColors, shadowsFor, type Palette } from "../theme";

const PREFERENCE_KEY = "@stride/appearance_v1";

export type Appearance = "system" | "light" | "dark";

type ThemeValue = {
  colors: Palette;
  /** What is actually being shown, after resolving "system". */
  scheme: "light" | "dark";
  isDark: boolean;
  shadows: ReturnType<typeof shadowsFor>;
  preference: Appearance;
  setPreference: (next: Appearance) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<Appearance>("system");

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(PREFERENCE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      } catch {
        // A missing or corrupt preference just means "follow the system".
      }
    })();
  }, []);

  const setPreference = useCallback((next: Appearance) => {
    setPreferenceState(next);
    AsyncStorage.setItem(PREFERENCE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: "light" | "dark" =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;

  const value = useMemo<ThemeValue>(() => {
    const isDark = scheme === "dark";
    return {
      colors: isDark ? darkColors : lightColors,
      scheme,
      isDark,
      shadows: shadowsFor(isDark),
      preference,
      setPreference,
    };
  }, [scheme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Turns a palette-dependent style object into a hook.
 *
 * Usage mirrors `StyleSheet.create` closely enough that converting a screen is
 * mechanical:
 *
 *     const useStyles = makeStyles((colors) => ({ root: { backgroundColor: colors.canvas } }));
 *     // inside the component:
 *     const styles = useStyles();
 *
 * The cache is keyed on the palette object itself. There are exactly two of
 * those and they are module constants, so a screen's stylesheet is built at most
 * twice for the life of the process — not on every render, and not on every
 * theme flip back and forth.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Palette) => T,
): () => T {
  const cache = new Map<Palette, T>();

  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => {
      const cached = cache.get(colors);
      if (cached) return cached;
      const created = StyleSheet.create(factory(colors));
      cache.set(colors, created);
      return created;
      // `factory` is a module constant; only the palette can change the result.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colors]);
  };
}
