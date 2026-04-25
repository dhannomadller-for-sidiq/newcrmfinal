// ── Nomadller Design System ─── Navy Blue CRM Theme ──────────────────────────
// Inspired by: deep navy background + electric blue primary + subtle blue-tinted surfaces

export const C = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg:          '#0D1321',   // deep navy — page background
  surface:     '#151E30',   // card surface — slightly lighter navy
  surface2:    '#1C2740',   // nested surface / input bg
  surface3:    '#233050',   // hover / pressed state
  border:      '#1E2D45',   // subtle border
  borderDark:  '#28395A',   // stronger border / divider

  // ── Primary — electric blue / indigo ─────────────────────────────────────
  primary:     '#4C6EF5',   // electric blue — hero / CTA / active
  primaryDark: '#3758DE',   // pressed state
  primaryLight:'#1A2550',   // blue tint bg (dark)
  primaryGlow: '#4C6EF5',   // shadow color

  // ── Accent colors ─────────────────────────────────────────────────────────
  amber:       '#F59E0B',   // orange/amber — warnings, pipeline
  amberLight:  '#2A1E08',   // amber tint bg
  green:       '#22C55E',   // success green
  greenLight:  '#0D2318',   // green tint bg
  red:         '#EF4444',   // error / lost
  redLight:    '#240E0E',   // red tint bg
  blue:        '#38BDF8',   // sky blue — info / call
  blueLight:   '#0A1E2E',   // sky tint bg
  purple:      '#A78BFA',   // purple — allocated / special
  purpleLight: '#1A1035',   // purple tint bg
  teal:        '#14B8A6',   // teal — operations
  tealLight:   '#081E1C',   // teal tint bg

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#E8EEF8',   // warm blue-white
  textSecond:  '#7A90B8',   // medium blue-gray
  textMuted:   '#3D5070',   // muted blue-gray
  textLight:   '#1E2D45',   // barely visible
  textOnDark:  '#FFFFFF',

  // ── Shadows ──────────────────────────────────────────────────────────────
  shadow: { color: '#000000', offset: { width: 0, height: 4 }, opacity: 0.4, radius: 14, elevation: 8 },
};

export const R = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   22,
  xxl:  28,
  xxxl: 36,
  full: 999,
};

export const S = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
};
