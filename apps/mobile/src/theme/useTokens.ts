import { space, radius, type, motion, shadowToRN, trackingToRN } from "@is/tokens";
import { useTheme } from "./ThemeProvider";

/**
 * Convenience hook: the active theme plus the platform-agnostic scales.
 * Use `t.ramp.gold[300]`, `space.s5`, `radius.sm`, `shadowToRN("md", t.name)`, etc.
 */
export function useTokens() {
  const { theme, name, setName } = useTheme();
  return {
    theme,
    name,
    setName,
    space,
    radius,
    type,
    motion,
    shadow: (k: "sm" | "md" | "lg") => shadowToRN(k, name),
    tracking: trackingToRN,
  };
}
