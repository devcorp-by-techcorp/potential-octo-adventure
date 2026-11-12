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
 * ── CONTRACT (read before editing) ──────────────────────────
 *  • PER-THEME RAMPS. Gold and sage are NOT a single shared ramp:
 *    light runs brass (#a8884f-centred), dark runs champagne
 *    (#c9a96e-centred), and sage INVERTS between themes. Each theme
 *    therefore carries its own `ramp`. Never read `palette.gold`
 *    directly in a component — go through the active theme.
 *  • CSS VAR VOCABULARY. `themeToCSSVars()` is the ONLY generator of
 *    the variables the shipped stylesheets read. Those are the
 *    "scale" names: --ink-* (surfaces), --bone-* (text), --gold-*,
 *    --sage-*, --success/--danger/--info/--warning, --shadow-*,
 *    --gold-text-grad/--gold-fill-grad, --scrim. Semantic aliases
 *    (--surface-*, --ink-primary, --brand-gold …) are emitted too,
 *    for app-level code and to mirror the RN object — but the scale
 *    names are what styles.css / ds-styles.css actually consume.
 *  • NAMING CAVEAT. On web, --ink-* means SURFACE/background and
 *    --bone-* means TEXT. In the JS object the word "ink" means TEXT
 *    (ink.primary). This is historical; do not "fix" one without the
 *    other or you desync web and native.
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
  creamHi: "#fdf8ee",   // near-white cream — text on gold buttons (light)

  // Brand gold — TWO ramps (the system is brassier in light, champagne in dark)
  goldBrass:     { 100: "#d4b87a", 200: "#b89868", 300: "#a8884f", 400: "#826737", 500: "#5a481f" },
  goldChampagne: { 100: "#e8d5a6", 200: "#d4b87a", 300: "#c9a96e", 400: "#a8884f", 500: "#826737" },

  // Olive/sage secondary accent — light ramp + its dark inversion
  sageLight: { 100: "#dde3d2", 200: "#b5c2a4", 300: "#828d72", 400: "#5e6852", 500: "#3d4534" },
  sageDark:  { 100: "#4a5440", 200: "#5e6852", 300: "#828d72", 400: "#a4ad96", 500: "#c4cab8" },

  // Status — shared across both themes
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

export interface Ramp5 { 100: string; 200: string; 300: string; 400: string; 500: string; }
export interface SurfaceRamp { 0: string; 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; }
export interface TextRamp { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string; }

export interface ThemeShadow { sm: string; md: string; lg: string; gold: string; }
export interface ThemeGradient { text: string; fill: string; }

export interface Theme {
  name: ThemeName;
  /** Raw per-theme ramps — these back the CSS scale vars (--ink-*, --bone-*, --gold-*, --sage-*). */
  ramp: {
    surface: SurfaceRamp;   // → --ink-*
    text:    TextRamp;      // → --bone-*
    gold:    Ramp5;         // → --gold-*
    sage:    Ramp5;         // → --sage-*
  };
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
  shadow: ThemeShadow;     // ready-to-use box-shadow strings (web)
  gradient: ThemeGradient; // gold text + fill gradients
  scrim: string;
}

const STATUS = {
  success: palette.success,
  danger:  palette.danger,
  info:    palette.info,
  warning: palette.warning,
};

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: "light",
    ramp: {
      surface: palette.paper,
      text:    palette.navy,
      gold:    palette.goldBrass,
      sage:    palette.sageLight,
    },
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
      gold:    palette.goldBrass[400],   // #826737 — matches CSS --gold-400 (light)
    },
    ink: {
      primary:   palette.navy[50],
      secondary: palette.navy[200],
      tertiary:  palette.navy[300],
      disabled:  palette.navy[500],
      inverse:   palette.creamHi,
    },
    brand: {
      gold:      palette.goldBrass[300],  // #a8884f — the user-picked brass
      goldHover: palette.goldBrass[200],  // #b89868
      goldMuted: "rgba(168,136,79,0.12)",
    },
    status: { ...STATUS },
    shadow: {
      sm:   "0 1px 2px rgba(20,30,50,0.06)",
      md:   "0 4px 16px rgba(20,30,50,0.08), 0 1px 2px rgba(20,30,50,0.05)",
      lg:   "0 24px 50px rgba(20,30,50,0.12), 0 4px 12px rgba(20,30,50,0.06)",
      gold: "0 0 0 1px rgba(168,136,79,0.28), 0 12px 30px rgba(168,136,79,0.12)",
    },
    gradient: {
      text: "linear-gradient(180deg, #b89868 0%, #a8884f 50%, #5a481f 100%)",
      fill: "radial-gradient(120% 80% at 30% 30%, rgba(255,235,190,0.5), transparent 60%), linear-gradient(135deg, #d4b87a 0%, #a8884f 50%, #5a481f 100%)",
    },
    scrim: "rgba(14,23,48,0.55)",
  },
  dark: {
    name: "dark",
    ramp: {
      surface: palette.ink,
      text:    palette.cream,
      gold:    palette.goldChampagne,
      sage:    palette.sageDark,
    },
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
      gold:    palette.goldChampagne[400],  // #a8884f
    },
    ink: {
      primary:   palette.cream[50],
      secondary: palette.cream[200],
      tertiary:  palette.cream[300],
      disabled:  palette.cream[400],
      inverse:   palette.ink[50],
    },
    brand: {
      gold:      palette.goldChampagne[300], // #c9a96e
      goldHover: palette.goldChampagne[100], // #e8d5a6
      goldMuted: "rgba(201,169,110,0.15)",
    },
    status: { ...STATUS },
    shadow: {
      sm:   "0 1px 2px rgba(0,0,0,0.5)",
      md:   "0 10px 30px rgba(0,0,0,0.5)",
      lg:   "0 30px 60px rgba(0,0,0,0.65)",
      gold: "0 0 0 1px rgba(201,169,110,0.25), 0 20px 40px rgba(201,169,110,0.08)",
    },
    gradient: {
      text: "linear-gradient(180deg, #f0dba8 0%, #c9a96e 45%, #8a6f3e 100%)",
      fill: "radial-gradient(120% 80% at 30% 30%, rgba(255,235,190,0.4), transparent 60%), linear-gradient(135deg, #e8d5a6 0%, #c9a96e 40%, #8a6f3e 100%)",
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

/* Primitive shadow geometry — used only by the RN adapter below.
   Web reads the ready-made theme.shadow strings instead. */
export const shadow = {
  sm: { offsetY: 1,  blur: 2,  alpha: { light: 0.06, dark: 0.50 } },
  md: { offsetY: 4,  blur: 16, alpha: { light: 0.10, dark: 0.50 } },
  lg: { offsetY: 24, blur: 50, alpha: { light: 0.14, dark: 0.65 } },
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

/** Web — ready-made box-shadow string, theme-aware. */
export const shadowToCSS = (
  k: "sm" | "md" | "lg" | "gold",
  theme: ThemeName = "light"
) => themes[theme].shadow[k];

/** RN — { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }, theme-aware. */
export const shadowToRN = (
  k: keyof typeof shadow,
  theme: ThemeName = "light"
) => {
  const s = shadow[k];
  const alpha = s.alpha[theme];
  // Dark theme shadows spread further, matching the web strings.
  const blur = theme === "dark" ? s.blur * (k === "sm" ? 1 : 1.9) : s.blur;
  const offsetY = theme === "dark" && k !== "sm" ? s.offsetY * 1.25 : s.offsetY;
  return {
    shadowColor: theme === "dark" ? "#000000" : "#141e32",
    shadowOffset: { width: 0, height: Math.round(offsetY) },
    shadowOpacity: alpha,
    shadowRadius: Math.round(blur / 2),
    elevation: Math.round(blur / 4),
  };
};

/** Letter-spacing helper for RN (returns dp). */
export const trackingToRN = (
  size: number,
  amount: keyof typeof type.tracking
) => size * type.tracking[amount];

/** Generate the CSS custom-property block for a theme — for web injection.
 *  Emits the SCALE vars the shipped stylesheets read, plus semantic aliases. */
export const themeToCSSVars = (t: Theme): Record<string, string> => {
  const vars: Record<string, string> = {};

  // ----- Scale vars (what styles.css / ds-styles.css actually read) -----
  // Surfaces → --ink-*
  (["0", "50", "100", "200", "300", "400", "500", "600"] as const).forEach(k => {
    vars[`--ink-${k.padStart(3, "0")}`] = (t.ramp.surface as any)[k];
  });
  // Text → --bone-*
  (["50", "100", "200", "300", "400", "500"] as const).forEach(k => {
    vars[`--bone-${k.padStart(3, "0")}`] = (t.ramp.text as any)[k];
  });
  // Gold + sage → --gold-* / --sage-*
  (["100", "200", "300", "400", "500"] as const).forEach(k => {
    vars[`--gold-${k}`] = (t.ramp.gold as any)[k];
    vars[`--sage-${k}`] = (t.ramp.sage as any)[k];
  });
  // Status
  vars["--success"] = t.status.success;
  vars["--danger"]  = t.status.danger;
  vars["--info"]    = t.status.info;
  vars["--warning"] = t.status.warning;
  // Shadows
  vars["--shadow-sm"]   = t.shadow.sm;
  vars["--shadow-md"]   = t.shadow.md;
  vars["--shadow-lg"]   = t.shadow.lg;
  vars["--shadow-gold"] = t.shadow.gold;
  // Gradients
  vars["--gold-text-grad"] = t.gradient.text;
  vars["--gold-fill-grad"] = t.gradient.fill;
  // Scrim
  vars["--scrim"] = t.scrim;

  // ----- Semantic aliases (portable; mirror the RN object) -----
  vars["--surface-canvas"]   = t.surface.canvas;
  vars["--surface-raised"]   = t.surface.raised;
  vars["--surface-elevated"] = t.surface.elevated;
  vars["--surface-inset"]    = t.surface.inset;
  vars["--surface-accent"]   = t.surface.accent;
  vars["--border-subtle"]    = t.border.subtle;
  vars["--border-default"]   = t.border.default;
  vars["--border-strong"]    = t.border.strong;
  vars["--border-gold"]      = t.border.gold;
  vars["--ink-primary"]      = t.ink.primary;
  vars["--ink-secondary"]    = t.ink.secondary;
  vars["--ink-tertiary"]     = t.ink.tertiary;
  vars["--ink-disabled"]     = t.ink.disabled;
  vars["--ink-inverse"]      = t.ink.inverse;
  vars["--brand-gold"]       = t.brand.gold;
  vars["--brand-gold-hover"] = t.brand.goldHover;
  vars["--brand-gold-muted"] = t.brand.goldMuted;

  return vars;
};

/* ============================================================
   5. ROLLUP — convenient single import
   ============================================================ */

export const tokens = {
  palette, themes, space, radius, type, shadow, motion, z, breakpoint,
};

export default tokens;
