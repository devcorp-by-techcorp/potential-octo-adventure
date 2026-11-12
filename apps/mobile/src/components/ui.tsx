/**
 * Shared UI primitives — the RN mirror of the web component library.
 * All sizing interpolates through useResponsive().fs so type + spacing scale
 * fluidly with available width (Mechanism Law §3). Tap targets ≥ 44pt.
 */
import React from "react";
import { View, Text, Pressable, StyleProp, ViewStyle, TextStyle } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Icon, IconName } from "./Icon";

type Tone = "success" | "warning" | "gold" | "muted";

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => {
  const { theme } = useTokens();
  const { fs } = useResponsive();
  return (
    <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.8, fontSize: fs(10), fontWeight: "600", color: color ?? theme.brand.gold }}>
      {children}
    </Text>
  );
};

export const Display: React.FC<{ children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }> = ({ children, size = 30, style }) => {
  const { theme } = useTokens();
  const { fs } = useResponsive();
  return (
    <Text style={[{ fontFamily: "CormorantGaramond_600SemiBold", fontWeight: "600", fontSize: fs(size), lineHeight: fs(size) * 1.04, letterSpacing: -0.3, color: theme.ink.primary }, style]}>
      {children}
    </Text>
  );
};

export const Body: React.FC<{ children: React.ReactNode; muted?: boolean; size?: number; numberOfLines?: number; style?: StyleProp<TextStyle> }> = ({ children, muted, size = 14, numberOfLines, style }) => {
  const { theme } = useTokens();
  const { fs } = useResponsive();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: "Inter_400Regular", fontSize: fs(size), lineHeight: fs(size) * 1.55, color: muted ? theme.ink.secondary : theme.ink.primary }, style]}>
      {children}
    </Text>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; gold?: boolean }> = ({ children, style, gold }) => {
  const { theme, radius } = useTokens();
  return (
    <View style={[{ backgroundColor: theme.surface.raised, borderWidth: 1, borderColor: gold ? theme.border.gold : theme.border.subtle, borderRadius: radius.sm }, style]}>
      {children}
    </View>
  );
};

export const Badge: React.FC<{ label: string; tone?: Tone }> = ({ label, tone = "muted" }) => {
  const { theme, radius } = useTokens();
  const map: Record<Tone, [string, string]> = {
    success: [theme.status.success, "rgba(122,155,110,0.14)"],
    warning: [theme.status.warning, "rgba(212,163,86,0.14)"],
    gold: [theme.brand.gold, theme.brand.goldMuted],
    muted: [theme.ink.tertiary, theme.surface.inset],
  };
  const [fg, bg] = map[tone];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: radius.xs, paddingVertical: 4, paddingHorizontal: 8 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, fontSize: 9, fontWeight: "600", color: fg }}>{label}</Text>
    </View>
  );
};

export const Button: React.FC<{
  label: string; onPress?: () => void; variant?: "primary" | "ghost"; icon?: IconName; fullWidth?: boolean; style?: StyleProp<ViewStyle>;
}> = ({ label, onPress, variant = "primary", icon, fullWidth, style }) => {
  const { theme, radius } = useTokens();
  const { fs } = useResponsive();
  const primary = variant === "primary";
  const fg = primary ? theme.ink.inverse : theme.ink.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{
        minHeight: 44, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.xs,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        alignSelf: fullWidth ? "stretch" : "flex-start", width: fullWidth ? "100%" : undefined,
        backgroundColor: primary ? theme.brand.gold : "transparent",
        borderWidth: primary ? 0 : 1, borderColor: theme.border.default,
        opacity: pressed ? 0.85 : 1,
      }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(11), fontWeight: "600", color: fg }}>{label}</Text>
    </Pressable>
  );
};
