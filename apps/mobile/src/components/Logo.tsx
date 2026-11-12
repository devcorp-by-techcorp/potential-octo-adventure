/**
 * Logo — RN mirror of the web design system's LogoMark / LogoBanner
 * (@illuminate components.jsx). Renders the real brand PNGs at their true
 * aspect ratio (never forced square) so the lens mark is never distorted.
 *
 * variant picks the asset made for the surface it sits on:
 *  - "onDark"  → gold mark/banner, for dark surfaces or photographic panels
 *  - "onLight" → charcoal mark/banner, for paper/light surfaces
 * Defaults to the active theme's natural surface when omitted.
 */
import React from "react";
import { Image } from "react-native";
import { useTheme } from "~/theme/ThemeProvider";

const ASSETS = {
  onDark: {
    mark: require("../../assets/images/lens-gold.png"),
    markRatio: 623 / 553,
    banner: require("../../assets/images/logo-banner-gold.png"),
    bannerRatio: 3280 / 597,
  },
  onLight: {
    mark: require("../../assets/images/lens-dark.png"),
    markRatio: 636 / 601,
    banner: require("../../assets/images/logo-banner-dark.png"),
    bannerRatio: 3190 / 610,
  },
} as const;

type Variant = keyof typeof ASSETS;

export const LogoMark: React.FC<{ size?: number; variant?: Variant }> = ({ size = 36, variant }) => {
  const { name } = useTheme();
  const a = ASSETS[variant ?? (name === "dark" ? "onDark" : "onLight")];
  return (
    <Image
      source={a.mark}
      resizeMode="contain"
      accessibilityLabel="Illuminate Studios"
      style={{ width: size, height: size / a.markRatio }}
    />
  );
};

export const LogoBanner: React.FC<{ height?: number; variant?: Variant }> = ({ height = 28, variant }) => {
  const { name } = useTheme();
  const a = ASSETS[variant ?? (name === "dark" ? "onDark" : "onLight")];
  return (
    <Image
      source={a.banner}
      resizeMode="contain"
      accessibilityLabel="Illuminate Studios"
      style={{ height, width: height * a.bannerRatio }}
    />
  );
};
