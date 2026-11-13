/**
 * useResponsive — the single source of runtime layout geometry.
 *
 * Implements the Studio Suite "Mechanism Law" (Universal Responsive Design
 * Requirement §4.2):
 *   1. Layout is driven by MEASURED runtime geometry (useWindowDimensions —
 *      a subscribed, re-rendering source), never by device identification.
 *   2. Device-class branches are refinements, never the sole mechanism.
 *   3. Type + spacing interpolate from the shared @illuminate/tokens scale
 *      against available space, not hard-coded per device.
 *   6. Orientation is an independent axis; it updates instantly on rotation
 *      because useWindowDimensions re-renders with fresh width/height.
 *
 * Everything a screen needs to reflow comes from here.
 */
import { useWindowDimensions } from "react-native";
import { space as SPACE } from "@illuminate/tokens";

export type Orientation = "portrait" | "landscape";
export type DeviceClass = "handset" | "handsetPlus" | "tablet" | "largeTablet";

export interface Responsive {
  width: number;
  height: number;
  orientation: Orientation;
  /** < 760pt available width → single-pane, bottom-tab navigation. */
  isCompact: boolean;
  isWide: boolean;
  deviceClass: DeviceClass;
  /** Fluid multiplier, clamped so the small-end stays legible and wide
   *  screens never balloon. The native analogue of web `clamp()`. */
  scale: number;
  /** Interpolate a base pt/dp size against available width. */
  fs: (base: number) => number;
  /** Fluid outer gutter derived from width (min 16, max 32). */
  gutter: number;
  /** Column count for responsive grids (gallery / cards). */
  columns: (min?: number) => number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const orientation: Orientation = width >= height ? "landscape" : "portrait";
  const isCompact = width < 760;

  const deviceClass: DeviceClass =
    width < 480 ? "handset" : width < 760 ? "handsetPlus" : width < 1024 ? "tablet" : "largeTablet";

  // 375pt small-end → 0.9; 1080pt → 1.0; caps at 1.18 so wide screens hold line length.
  const scale = Math.max(0.9, Math.min(1.18, width / 1080));
  const fs = (base: number) => Math.round(base * scale);
  const gutter = Math.round(Math.max(SPACE.s4, Math.min(SPACE.s6, width * 0.045)));

  const columns = (minItem = 260) => {
    const usable = width - gutter * 2;
    return Math.max(1, Math.min(4, Math.floor(usable / minItem)) || 1);
  };

  return { width, height, orientation, isCompact, isWide: !isCompact, deviceClass, scale, fs, gutter, columns };
}
