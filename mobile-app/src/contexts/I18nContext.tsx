/**
 * Language selection and string lookup.
 *
 * Modelled on `ThemeContext`, including the three-valued preference: "system"
 * follows the device, and an explicit choice overrides it. Storing a bare code
 * would silently freeze "follow my phone" into whatever the phone happened to
 * be set to on the day the app was first opened.
 *
 * `t()` takes a key that must exist in the string table, so a typo is a compile
 * error rather than a blank label at runtime.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

import { LANGUAGES, type LanguageCode, type Strings } from "../i18n/strings";

const KEY = "@stride/language_v1";

export type LanguagePreference = "system" | LanguageCode;

type I18nValue = {
  /** What is actually in use, after resolving "system". */
  language: LanguageCode;
  preference: LanguagePreference;
  setPreference: (next: LanguagePreference) => void;
  t: (key: keyof Strings, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

/** The device's language, if this app has it; English otherwise. */
function deviceLanguage(): LanguageCode {
  try {
    const tag = getLocales()[0]?.languageCode ?? "en";
    return tag in LANGUAGES ? (tag as LanguageCode) : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>("system");

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY);
        if (stored === "system" || (stored && stored in LANGUAGES)) {
          setPreferenceState(stored as LanguagePreference);
        }
      } catch {
        // A missing or unreadable preference just means "follow the device".
      }
    })();
  }, []);

  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(KEY, next).catch(() => undefined);
  }, []);

  const language: LanguageCode = preference === "system" ? deviceLanguage() : preference;

  const value = useMemo<I18nValue>(() => {
    const strings = LANGUAGES[language].strings;
    return {
      language,
      preference,
      setPreference,
      t: (key, vars) => {
        const template = strings[key];
        if (!vars) return template;
        // Replace every {name} that was actually supplied. An unsupplied
        // placeholder is left as-is rather than printing "undefined".
        return Object.entries(vars).reduce(
          (out, [name, v]) => out.split(`{${name}}`).join(String(v)),
          template,
        );
      },
    };
  }, [language, preference, setPreference]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
