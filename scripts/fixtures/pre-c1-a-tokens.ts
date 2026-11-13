/**
 * ILLUMINATE STUDIOS — Shared Design Tokens
 * ------------------------------------------------------------
 * Single source of truth consumed by:
 *   • React Vite (web)   — via CSS custom properties + JS imports
 *   • Expo React Native  — via StyleSheet + Themed hook
 *
 * Tokens are platform-agnostic primitives. Each semantic theme
 * (light, dark) maps the primitives to roles a component asks
 * for ("surface", "ink.primary", etc.) so component code does
 * NOT care which platform it runs on.
 *
 * Usage:
 *   import { tokens, themes, useTheme } from "./tokens";
 *   const t = useTheme();           // light | dark, swaps live
 *   <View style={{ background: t.surface.canvas }}>
 */

/* ============================================================
   1. PRIMITIVES — raw values, never reference these directly
                   in components. Always go through a theme.
   ============================================================ */

export const palette = {
  // Cool off-whites & navy inks (light theme surface + text)
  paper:   { 0: "#ffffff", 50: "#fafbfc", 100: "#ffffff", 200: "#f1f4f7",
             300: "#e1e7ed", 400: "#c4cdd6", 500: "#8a96a3", 600: "#4a5666" },
  navy:    { 50:  "#0e1730", 100: "#1a2540", 200: "#34405a",
             300: "#5a6378", 400: "#828a9a", 500: "#aab1be" },

  // True blacks & creams (dark theme surface + text)
  ink:     { 0: "#050505", 50: "#0a0a0a", 100: "#0f0f0f", 200: "#141414",
             300: "#1c1c1c", 400: "#242424", 500: "#2e2e2e", 600: "#3a3a3a" },
  cream:   { 50:  "#f4ebd9", 100: "#e8dcc4", 200: "#c9b896",
             300: "#8a8275", 400: "#5a5347", 500: "#3d3830" },

  // Brand gold — single ramp shared by both themes (different roles)
  gold:    { 100: "#e8d5a6", 200: "#d4b87a", 300: "#c9a96e",
             400: "#a8884f", 500: "#826737" },

  // Olive/sage secondary accent
  sage:    { 100: "#dde3d2", 200: "#b5c2a4", 300: "#828d72",
             400: "#5e6852", 500: "#3d4534" },

  // Status
  success: "#7a9b6e",
  danger:  "#b86a5b",
  info:    "#8aa3b8",
  warning: "#d4a356",
} as const;

/* ============================================================
   2. SEMANTIC THEMES — components consume these names.
                        Keys must match between light + dark.
   ============================================================ */

export type ThemeName = "light" | "dark";

export interface Theme {
  name: ThemeName;
  surface: {
    canvas: string;     // page background
    raised: string;     // card, panel
    elevated: string;   // modal, popover
    inset: string;      // input background
    accent: string;     // hover / tint
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    gold: string;
  };
  ink: {
    primary: string;    // headings, body
    secondary: string;  // muted body
    tertiary: string;   // labels, hints
    disabled: string;
    inverse: string;    // on-gold buttons
  };
  brand: {
    gold: string;
    goldHover: string;
    goldMuted: string;
  };
  status: {
    success: string;
    danger:  string;
    info:    string;
    warning: string;
  };
  scrim: string;
}

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: "light",
    surface: {
      canvas:   palette.paper[50],
      raised:   palette.paper[100],
      elevated: palette.paper[100],
      inset:    palette.paper[200],
      accent:   palette.paper[300],
    },
    border: {
      subtle:  palette.paper[300],
      default: palette.paper[400],
      strong:  palette.paper[500],
      gold:    palette.gold[400],
    },
    ink: {
      primary:   palette.navy[50],
      secondary: palette.navy[200],
      tertiary:  palette.navy[300],
      disabled:  palette.navy[500],
      inverse:   "#fdf8ee",
    },
    brand: {
      gold:      palette.gold[400],   // brass #a8884f  (alt: gold[300] champagne #c9a96e)
      goldHover: palette.gold[300],
      goldMuted: "rgba(168,136,79,0.12)",
    },
    status: palette as any && {
      success: palette.success,
      danger:  palette.danger,
      info:    palette.info,
      warning: palette.warning,
    },
    scrim: "rgba(14,23,48,0.55)",
  },
  dark: {
    name: "dark",
    surface: {
      canvas:   palette.ink[50],
      raised:   palette.ink[200],
      elevated: palette.ink[100],
      inset:    palette.ink[300],
      accent:   palette.ink[400],
    },
    border: {
      subtle:  palette.ink[400],
      default: palette.ink[500],
      strong:  palette.ink[600],
      gold:    palette.gold[400],
    },
    ink: {
      primary:   palette.cream[50],
      secondary: palette.cream[200],
      tertiary:  palette.cream[300],
      disabled:  palette.cream[400],
      inverse:   palette.ink[50],
    },
    brand: {
      gold:      palette.gold[300],
      goldHover: palette.gold[100],
      goldMuted: "rgba(201,169,110,0.15)",
    },
    status: {
      success: palette.success,
      danger:  palette.danger,
      info:    palette.info,
      warning: palette.warning,
    },
    scrim: "rgba(0,0,0,0.85)",
  },
};

/* ============================================================
   3. NON-COLOR TOKENS
   ============================================================ */

export const space = {
  s1:  4, s2:  8, s3: 12, s4: 16, s5: 24,
  s6: 32, s7: 48, s8: 64, s9: 96, s10: 128,
} as const;

export const radius = {
  none: 0, xs: 2, sm: 4, md: 8, lg: 16, full: 9999,
} as const;

export const type = {
  family: {
    display: '"Cinzel", "Trajan Pro", Georgia, serif',
    serif:   '"Cormorant Garamond", "EB Garamond", Georgia, serif',
    body:    '"Inter", system-ui, -apple-system, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, monospace',
  },
  // Native-friendly numeric sizes (px on web, dp on RN)
  size: {
    xs: 10, sm: 12, base: 14, md: 16, lg: 18, xl: 22,
    "2xl": 28, "3xl": 36, "4xl": 48, "5xl": 64, "6xl": 88,
  },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  // RN uses unitless line-height multiplied by size; web uses ratio.
  leading: { tight: 1.15, snug: 1.3, normal: 1.55, relaxed: 1.7 },
  // Letter-spacing in em (multiply by size for RN dp)
  tracking: { tight: -0.01, normal: 0, wide: 0.08, wider: 0.24, widest: 0.32 },
} as const;

export const shadow = {
  // Web: box-shadow string. RN: object via shadowToRN(). See below.
  sm: { offsetY: 1, blur: 2,  alpha: 0.06 },
  md: { offsetY: 4, blur: 16, alpha: 0.10 },
  lg: { offsetY: 24, blur: 50, alpha: 0.14 },
} as const;

export const motion = {
  easing: {
    out:    "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut:  "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  duration: { fast: 180, medium: 340, slow: 700 },
} as const;

export const z = {
  base: 0, raised: 10, dropdown: 100, modal: 1000, toast: 2000, max: 9999,
} as const;

export const breakpoint = {
  sm: 480, md: 768, lg: 1024, xl: 1280, "2xl": 1536,
} as const;

/* ============================================================
   4. PLATFORM ADAPTERS
   ============================================================ */

/** Web — flat box-shadow string */
export const shadowToCSS = (k: keyof typeof shadow, color = "20,30,50") => {
  const s = shadow[k];
  return `0 ${s.offsetY}px ${s.blur}px rgba(${color},${s.alpha})`;
};

/** RN — { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation } */
export const shadowToRN = (k: keyof typeof shadow) => {
  const s = shadow[k];
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: s.offsetY },
    shadowOpacity: s.alpha,
    shadowRadius: s.blur / 2,
    elevation: Math.round(s.blur / 4),
  };
};

/** Letter-spacing helper for RN (returns dp). */
export const trackingToRN = (
  size: number,
  amount: keyof typeof type.tracking
) => size * type.tracking[amount];

/** Generate CSS custom-property block from a theme — for web injection. */
export const themeToCSSVars = (t: Theme) => ({
  "--surface-canvas":   t.surface.canvas,
  "--surface-raised":   t.surface.raised,
  "--surface-elevated": t.surface.elevated,
  "--surface-inset":    t.surface.inset,
  "--surface-accent":   t.surface.accent,
  "--border-subtle":    t.border.subtle,
  "--border-default":   t.border.default,
  "--border-strong":    t.border.strong,
  "--border-gold":      t.border.gold,
  "--ink-primary":      t.ink.primary,
  "--ink-secondary":    t.ink.secondary,
  "--ink-tertiary":     t.ink.tertiary,
  "--ink-disabled":     t.ink.disabled,
  "--ink-inverse":      t.ink.inverse,
  "--brand-gold":       t.brand.gold,
  "--brand-gold-hover": t.brand.goldHover,
  "--brand-gold-muted": t.brand.goldMuted,
  "--status-success":    t.status.success,
  "--status-danger":     t.status.danger,
  "--status-info":       t.status.info,
  "--status-warning":    t.status.warning,
  "--scrim":            t.scrim,
});

/* ============================================================
   5. ROLLUP — convenient single import
   ============================================================ */

export const tokens = {
  palette, themes, space, radius, type, shadow, motion, z, breakpoint,
};

export default tokens;
