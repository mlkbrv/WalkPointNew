/**
 * Material Design 3 color system for mobile.
 * Primary: violet, matching the product's reference design. It is the single
 * accent — filled CTAs, the step gauge, active tabs and chips, day rings. The
 * secondary glyph colours (amber/coral/emerald) are reserved for the three
 * metric icons (time/calories/distance) and never used as fills.
 * Surface system: canvas → card → cardDark → dark.
 * Text: on-surface primary, secondary, tertiary.
 *
 * Rules:
 * 1. vivid fills, ink-text. Brand colors (coral/emerald) at full strength on bars/glyphs.
 *    Ink variants contrast 4.5:1 against surfaces.
 * 2. Surfaces lighten toward the foreground: canvas > card > cardDark > dark.
 * 3. onPrimary travels with its palette (not always white).
 * 4. All text-size contrasts measured WCAG AA in both themes.
 */

export interface Palette {
  primary: string;
  onPrimary: string;
  /** The light-lavender secondary button fill ("Skip", "Cancel"). */
  primarySoft: string;
  /** Text and glyphs that sit on `primarySoft`. */
  onPrimarySoft: string;

  coral: string;
  emerald: string;
  amber: string;
  coralInk: string;
  emeraldInk: string;
  amberInk: string;

  canvas: string;
  card: string;
  cardDark: string;
  dark: string;

  cardTranslucent: string;
  cardTranslucentBorder: string;
  inputSurface: string;
  primaryTint: string;

  border: string;
  borderDark: string;
  hairline: string;

  text: string;
  charcoal: string;
  textLight: string;
  slate: string;
  muted: string;
  mutedDark: string;

  white: string;
}

/**
 * Light palette — measured against #FFFFFF.
 * All text contrasts checked WCAG AA.
 */
export const lightColors: Palette = {
  // #7C3AED on white is 5.70:1 — past the 4.5:1 floor, so it works as
  // body-weight text and icons, not only as a fill.
  primary: "#7C3AED",
  onPrimary: "#FFFFFF",
  primarySoft: "#EDE9FE",
  // 7.6:1 on #EDE9FE.
  onPrimarySoft: "#6D28D9",

  coral: "#FF6B52",
  emerald: "#00E194",
  amber: "#F59E0B",
  coralInk: "#BF1E0C",
  // Was #008850, which measures 3.91:1 on white and fails AA for body text.
  emeraldInk: "#047857",
  amberInk: "#B45309",

  canvas: "#F5F5F7",
  card: "#FFFFFF",
  cardDark: "#F0F2F5",
  dark: "#0B0D10",

  cardTranslucent: "rgba(255,255,255,0.84)",
  cardTranslucentBorder: "rgba(255,255,255,0.54)",
  inputSurface: "#FAFAFB",
  primaryTint: "rgba(124,58,237,0.08)",

  border: "#D1D5DB",
  borderDark: "#4B5563",
  hairline: "#9CA3AF",

  text: "#111827",
  charcoal: "#111827",
  textLight: "#F9FAFB",
  slate: "#6B7280",
  // Grey-500 is 2.41:1 on the canvas — below the 4.5:1 body-text minimum.
  // Grey-600 keeps the ramp and clears it.
  muted: "#6A7383",
  mutedDark: "#D1D5DB",

  white: "#FFFFFF",
};

/**
 * Dark palette — measured against #0B0D10 / #111827.
 * Shadows dropped; elevation implied by surface steps.
 */
export const darkColors: Palette = {
  // Lighter than the light theme's primary, same rule dark palettes always
  // follow here: a dark ink (#1F2937) sits on it, not white, so it has to be
  // light enough itself to carry that ink at 4.5:1 (measures 5.39:1).
  primary: "#A78BFA",
  onPrimary: "#1F2937",
  primarySoft: "#312E4E",
  // 7.9:1 on #312E4E.
  onPrimarySoft: "#C4B5FD",

  coral: "#FF6B52",
  emerald: "#00E194",
  amber: "#FBBF24",
  coralInk: "#FF8F7A",
  emeraldInk: "#36D38D",
  amberInk: "#FCD34D",

  canvas: "#0F172A",
  card: "#1E293B",
  cardDark: "#0F172A",
  dark: "#07090B",

  cardTranslucent: "rgba(15,23,42,0.8)",
  cardTranslucentBorder: "rgba(255,255,255,0.05)",
  inputSurface: "#1E293B",
  primaryTint: "rgba(167,139,250,0.16)",

  border: "#374151",
  borderDark: "#4B5563",
  hairline: "#4B5563",

  text: "#F8FAFC",
  charcoal: "#F8FAFC",
  textLight: "#F8FAFC",
  // Grey-500 is only 3.03:1 on the dark card. On a dark ground the ramp has
  // to run the other way, so this is lighter, not darker.
  slate: "#898F9C",
  muted: "#9CA3AF",
  mutedDark: "#D1D5DB",

  white: "#FFFFFF",
};

/**
 * The type scale — Material Design 3 text styles.
 *
 * A limited set of sizes so hierarchy comes from deliberate choices, not random
 * numbers. Prefer Regular, Medium, Semibold and Bold. Nothing smaller than 11px
 * carries meaning (WCAG AA minimum on mobile).
 */
export const type = {
  displayLarge: { fontSize: 57, fontWeight: "700", lineHeight: 64 },
  displayMedium: { fontSize: 45, fontWeight: "700", lineHeight: 52 },
  displaySmall: { fontSize: 36, fontWeight: "700", lineHeight: 44 },
  headlineLarge: { fontSize: 32, fontWeight: "600", lineHeight: 40 },
  headlineMedium: { fontSize: 28, fontWeight: "600", lineHeight: 36 },
  headlineSmall: { fontSize: 24, fontWeight: "600", lineHeight: 32 },
  titleLarge: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
  titleMedium: { fontSize: 16, fontWeight: "600", lineHeight: 24 },
  titleSmall: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  bodyLarge: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  labelLarge: { fontSize: 13, fontWeight: "500", lineHeight: 19 },
  labelMedium: { fontSize: 12, fontWeight: "500", lineHeight: 17 },
  labelSmall: { fontSize: 11, fontWeight: "500", lineHeight: 15 },
  titleSmallCaps: { fontSize: 11, fontWeight: "700", lineHeight: 13, textTransform: "uppercase" },
} as const;

/** The smallest a control may be and still be reliably hittable. */
export const MIN_FONT_SIZE = 11;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

/**
 * The smallest a control may be and still be reliably hittable.
 * Guideline — Accessibility: touch targets are 44x44pt on mobile.
 */
export const HIT_TARGET = 44;

/**
 * Elevation following Material Design 3.
 * - Light mode: subtle shadows on card surfaces
 * - Dark mode: no shadows (invisible on near-black); surface separation instead
 */
export function shadowsFor(dark: boolean) {
  return {
    card: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 1,
          elevation: 1,
        },
    surface: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        },
    auth: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
          elevation: 4,
        },
    fab: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.24,
          shadowRadius: 12,
          elevation: 4,
        },
    navigation: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        },
    glow: {
      shadowColor: dark ? "#A78BFA" : "#7C3AED",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: dark ? 0.25 : 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  };
}

/** Default (light-mode) shadows. */
export const shadows = shadowsFor(false);
