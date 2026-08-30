/**
 * The design system: two palettes, one shape.
 *
 * Both palettes carry exactly the same keys, so a screen never asks which theme
 * it is in — it reads `colors.card` and gets the right surface. The provider in
 * `contexts/ThemeContext` chooses between them.
 *
 * Three rules the palettes encode:
 *
 * 1. **Vivid for fills, `-Ink` for text.** `emerald` and `coral` are the brand
 *    at full strength and belong on bars, rings and large glyphs. As small text
 *    they measure 1.72:1 and 2.81:1 on white, so each has an `-Ink` variant of
 *    the same hue moved until it clears 4.5:1. In dark mode the ink variants are
 *    *lighter* than the base, not darker — contrast now runs the other way.
 *
 * 2. **Surfaces get lighter as they come closer.** Light mode separates layers
 *    with shadow; dark mode cannot, because a shadow on near-black is invisible.
 *    So `canvas → card → cardDark` ascends in dark mode and descends in light.
 *
 * 3. **`onPrimary` is not always white.** The dark palette lifts `primary` to
 *    #A97CFF so it reads against a dark ground, and white text on that is only
 *    2.99:1. The label colour therefore travels with the palette.
 *
 * Every pairing the app actually uses is checked against WCAG AA in both
 * palettes; the numbers below are measured, not estimated.
 */

export interface Palette {
  primary: string;
  /** Label colour for text sitting on `primary`. Not always white — see above. */
  onPrimary: string;

  /** Full-strength brand. Fills only. */
  coral: string;
  emerald: string;
  /** The same hues, moved until they clear 4.5:1 against this palette's surfaces. */
  coralInk: string;
  emeraldInk: string;

  /** Page background. */
  canvas: string;
  /** A card on the page. */
  card: string;
  /** A card on a card, or a deliberately dark panel. */
  cardDark: string;
  /** The darkest surface — full-bleed screens like Track and the auth gradient. */
  dark: string;

  /** The translucent card surface used by `GlassCard`, and its hairline. */
  cardTranslucent: string;
  cardTranslucentBorder: string;
  /** Text inputs and other inset wells, one step back from the card they sit on. */
  inputSurface: string;
  /** A faint wash of the brand colour: selected rows, the disc behind an illustration. */
  primaryTint: string;

  border: string;
  borderDark: string;
  /** Decorative only: dividers, inactive dots. Never carries meaning as text. */
  hairline: string;

  /** Primary text. */
  text: string;
  charcoal: string;
  /** Text on a permanently dark surface, whatever the theme. */
  textLight: string;
  /** Secondary text. */
  slate: string;
  /** Tertiary text: captions, labels, hints. */
  muted: string;
  /** Tertiary text on a permanently dark surface. */
  mutedDark: string;

  white: string;
}

/**
 * Measured against #FFFFFF / #F8F9FB:
 *   primary #8140F3 5.30:1 · slate #64748B 4.76:1 · muted #607490 4.53:1
 *   emeraldInk #008859 4.50:1 · coralInk #E62100 4.58:1 · white on primary 5.30:1
 */
export const lightColors: Palette = {
  primary: "#8140F3",
  onPrimary: "#FFFFFF",

  coral: "#FF6B52",
  emerald: "#00E194",
  coralInk: "#E62100",
  emeraldInk: "#008859",

  canvas: "#F8F9FB",
  card: "#FFFFFF",
  cardDark: "#1A1D24",
  dark: "#0B0D10",

  cardTranslucent: "rgba(255,255,255,0.92)",
  cardTranslucentBorder: "rgba(255,255,255,0.7)",
  inputSurface: "#F8FAFC",
  primaryTint: "rgba(129,64,243,0.06)",

  border: "#E8EAF0",
  borderDark: "#2E333F",
  hairline: "#94A3B8",

  text: "#121417",
  charcoal: "#121417",
  textLight: "#FAFAFC",
  slate: "#64748B",
  muted: "#607490",
  mutedDark: "#94A3B8",

  white: "#FFFFFF",
};

/**
 * Measured against #161A21 / #0B0D10:
 *   charcoal 15.84:1 · slate 8.32:1 · muted 6.12:1 · primary 5.83:1
 *   emeraldInk 11.57:1 · coralInk 7.86:1 · onPrimary on primary 6.55:1
 *   border vs canvas 1.75:1 (non-text, needs 1.5)
 */
export const darkColors: Palette = {
  primary: "#A97CFF",
  onPrimary: "#12061F",

  coral: "#FF6B52",
  emerald: "#00E194",
  coralInk: "#FF8F7A",
  emeraldInk: "#3DEDAE",

  canvas: "#0B0D10",
  card: "#161A21",
  cardDark: "#1F242D",
  dark: "#07090B",

  cardTranslucent: "rgba(22,26,33,0.92)",
  cardTranslucentBorder: "rgba(255,255,255,0.06)",
  // A well must be *darker* than its card here; in light mode it is lighter.
  inputSurface: "#0F1319",
  primaryTint: "rgba(169,124,255,0.12)",

  border: "#333C4B",
  borderDark: "#39414F",
  hairline: "#39414F",

  text: "#F2F4F8",
  charcoal: "#F2F4F8",
  textLight: "#F2F4F8",
  slate: "#A9B4C4",
  muted: "#8E9AAC",
  mutedDark: "#8E9AAC",

  white: "#FFFFFF",
};

/**
 * The type scale.
 *
 * Before this the app used fourteen different sizes between 8 and 28, with the
 * mass at 10–12 and 77% of every label set in 700, 800 or 900. That is why it
 * read as generated: nothing could stand out because everything shouted, and
 * fifty-six labels sat below the 11pt minimum that mobile guidance sets.
 *
 * These are the system text styles, which exist precisely so hierarchy comes
 * from a small, deliberate set rather than from picking a number per component.
 *
 * Guideline — Typography: mobile default 17pt, minimum 11pt; prefer Regular,
 * Medium, Semibold and Bold, and avoid lighter weights.
 */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700", lineHeight: 41 },
  title: { fontSize: 28, fontWeight: "700", lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: "600", lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: "600", lineHeight: 25 },
  /** A heading inside a card or a row. */
  headline: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  /** The default for reading. Anything long-form belongs here. */
  body: { fontSize: 17, fontWeight: "400", lineHeight: 22 },
  callout: { fontSize: 16, fontWeight: "400", lineHeight: 21 },
  subhead: { fontSize: 15, fontWeight: "400", lineHeight: 20 },
  footnote: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "400", lineHeight: 16 },
  /** The floor. Nothing smaller than this is allowed to carry meaning. */
  caption2: { fontSize: 11, fontWeight: "400", lineHeight: 13 },
} as const;

/** The smallest legible size on mobile, per the typography guidance. */
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
 * Elevation. In dark mode a drop shadow on a near-black ground is invisible, so
 * the shadow is dropped to nothing and the lighter `card` surface plus its
 * border carries the separation instead.
 */
export function shadowsFor(dark: boolean) {
  return {
    glass: dark
      ? { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, elevation: 0 }
      : {
          shadowColor: "#121417",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 4,
        },
    glow: {
      shadowColor: dark ? "#A97CFF" : "#8140F3",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: dark ? 0.25 : 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  };
}

/** Light-mode shadows, for the few places that are dark in both themes. */
export const shadows = shadowsFor(false);
