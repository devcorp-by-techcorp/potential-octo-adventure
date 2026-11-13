import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { themes, type Theme, type ThemeName } from "@is/tokens";

/**
 * Binds the shared @is/tokens `themes` object to React Native.
 * Web mirrors these same tokens into CSS custom properties (styles.css);
 * here they are consumed directly as JS values.
 *
 * Dark is the cinematic "lights-out" palette — on mobile it should be gated
 * to gallery-type screens (mirrors the web `darkAllowed` rule), not applied
 * globally from the OS colour scheme.
 */
interface ThemeContextValue {
  theme: Theme;
  name: ThemeName;
  setName: (n: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: themes.light,
  name: "light",
  setName: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode; initial?: ThemeName }> = ({
  children,
  initial,
}) => {
  const os = useColorScheme();
  const [name, setName] = useState<ThemeName>(initial ?? "light");
  // OS scheme is available (`os`) but intentionally NOT auto-applied — see note above.
  const value = useMemo(() => ({ theme: themes[name], name, setName }), [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
