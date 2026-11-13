/**
 * Icon — minimalist line set (react-native-svg). Paths are copied verbatim
 * from the approved web design system's Icon component (@illuminate
 * components.jsx) so RN and web share one icon vocabulary exactly.
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

const PATHS = {
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "M6 6l12 12M18 6L6 18",
  chevronR: "M9 6l6 6-6 6",
  chevronL: "M15 6l-6 6 6 6",
  chevronD: "M6 9l6 6 6-6",
  check: "M5 13l4 4L19 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6",
  folder: "M3 7v12h18V9H13l-2-2H3z",
  doc: "M7 3h8l4 4v14H7zM15 3v4h4",
  inbox: "M3 13l3-8h12l3 8M3 13v6h18v-6M8 13h2l1 2h2l1-2h2",
  pricing: "M7 4h10l3 4-8 12L4 8z M9 9h2 M9 13h6",
  gallery: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  calendar: "M3 7h18v14H3zM3 11h18M8 3v4M16 3v4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 11a4 4 0 100-8M22 21a7 7 0 00-7-7",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM16 16l5 5",
  bell: "M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0",
  star: "M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z",
  settings:
    "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  arrow: "M5 12h14M13 5l7 7-7 7",
  arrowL: "M19 12H5M11 5l-7 7 7 7",
  heart:
    "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z",
  edit: "M14 4l6 6L8 22H2v-6zM14 4l2-2 6 6-2 2",
  trash: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
  camera: "M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  clock: "M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  pin: "M12 21s-7-7.5-7-12a7 7 0 1114 0c0 4.5-7 12-7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
  logout: "M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4",
  sparkle: "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4",
  alert:
    "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.4 3.9a2 2 0 00-3.4 0z",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

export const Icon: React.FC<{ name: IconName; size?: number; color?: string; stroke?: number; fill?: string }> = ({
  name, size = 20, color = "currentColor", stroke = 1.5, fill = "none",
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <Path d={PATHS[name]} />
  </Svg>
);
