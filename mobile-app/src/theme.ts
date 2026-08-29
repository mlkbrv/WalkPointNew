/**
 * The design system.
 *
 * Brand colours and their accessible counterparts are separated on purpose.
 * `emerald` and `coral` are vivid on screen and read well as *fills* — a chart
 * bar, a progress ring, a large icon — but as small text on white they measure
 * 1.72:1 and 2.81:1, well under the 4.5:1 that body text needs. Rather than
 * dulling the brand everywhere, each has an `-Ink` variant of the same hue,
 * darkened until it clears the threshold.
 *
 * The rule: **`-Ink` for text and small glyphs, the plain name for fills.**
 *
 * Measured against white (#FFFFFF), WCAG 2.1 relative luminance:
 *
 *   primary    #8140F3   5.30:1   passes as text
 *   slate      #64748B   4.76:1   passes as text
 *   muted      #637895   4.52:1   passes as text  (was #94A3B8, 2.56:1)
 *   emeraldInk #008859   4.50:1   passes as text  (emerald is 1.72:1)
 *   coralInk   #E62100   4.58:1   passes as text  (coral is 2.81:1)
 *
 * `coralInk` doubles as the fill for destructive buttons, because white on
 * plain `coral` is only 2.81:1 — a label people with low vision cannot read.
 */

export const colors = {
  primary: "#8140F3",

  /** Vivid fills: bars, rings, large icons, backgrounds. Not for small text. */
  coral: "#FF6B52",
  emerald: "#00E194",

  /** Same hues, dark enough for text and small glyphs on light surfaces. */
  coralInk: "#E62100",
  emeraldInk: "#008859",

  canvas: "#F8F9FB",
  charcoal: "#121417",
  dark: "#0B0D10",
  card: "#FFFFFF",
  cardDark: "#1A1D24",
  border: "#E8EAF0",
  borderDark: "#2E333F",

  /**
   * Secondary text. Two tokens, not one: no single grey can clear 4.5:1 against
   * both #F8F9FB and #0B0D10 — the first demands a luminance below 0.172, the
   * second above 0.198. Use `muted` on light surfaces, `mutedDark` on dark ones.
   */
  muted: "#607490",
  mutedDark: "#94A3B8",
  slate: "#64748B",

  /** Decorative only — dividers, inactive dots. Never carries meaning as text. */
  hairline: "#94A3B8",

  text: "#121417",
  textLight: "#FAFAFC",
  white: "#FFFFFF",
};

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

export const shadows = {
  glass: {
    shadowColor: "#121417",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  glow: {
    shadowColor: "#8140F3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};
