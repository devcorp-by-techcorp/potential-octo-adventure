/** Application compatibility aliases; authoritative tokens stay unchanged. */
import { themeToCSSVars as referenceVars, type Theme } from "./tokens";
import * as reference from "./tokens";

export const palette = {
  ...reference.palette,
  gold: reference.palette.goldChampagne,
  sage: reference.palette.sageLight,
};

export const shadow = {
  sm: { ...reference.shadow.sm, alpha: reference.shadow.sm.alpha.light },
  md: { ...reference.shadow.md, alpha: reference.shadow.md.alpha.light },
  lg: { ...reference.shadow.lg, alpha: reference.shadow.lg.alpha.light },
};

/** Explicit theme arguments retain the reference contract; other strings are RGB colors. */
export const shadowToCSS = (
  key: "sm" | "md" | "lg" | "gold",
  colorOrTheme = "20,30,50",
) => {
  if (colorOrTheme === "light" || colorOrTheme === "dark" || key === "gold") {
    return reference.shadowToCSS(key, colorOrTheme === "dark" ? "dark" : "light");
  }
  const value = shadow[key];
  return `0 ${value.offsetY}px ${value.blur}px rgba(${colorOrTheme},${value.alpha})`;
};

export const shadowToRN = (key: keyof typeof shadow, theme?: reference.ThemeName) => {
  if (theme !== undefined) return reference.shadowToRN(key, theme);
  return { ...reference.shadowToRN(key, "light"), shadowColor: "#000" };
};

/** Public rollup follows the same compatibility contract as named exports. */
export const tokens = { ...reference.tokens, palette, shadow };

export const themeToCSSVars = (theme: Theme): Record<string, string> => ({
  ...referenceVars(theme),
  "--status-success": theme.status.success,
  "--status-danger": theme.status.danger,
  "--status-info": theme.status.info,
  "--status-warning": theme.status.warning,
});
