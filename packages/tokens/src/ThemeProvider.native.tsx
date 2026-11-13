import React, { createContext, useContext, useState } from "react";

import { themes, type ThemeName } from "./tokens";

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}

/**
 * Native ThemeProvider — context only, no DOM. Metro resolves this `.native`
 * variant automatically. `useTheme` returns the same resolved theme-object shape
 * as the web provider, so component code stays platform-agnostic. Mobile consumes
 * this in task 01.1.0.
 */
export const ThemeProvider = ({ children, defaultTheme = "light" }: ThemeProviderProps) => {
  const [theme, setTheme] = useState<ThemeName>(defaultTheme);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

/** Returns the resolved theme object for the active theme. */
export const useTheme = () => themes[useContext(ThemeContext).theme];
