/**
 * Finance UI parts — the small primitives the finance tabs share.
 * Type and spacing interpolate through useResponsive().fs; every control
 * clears the 44pt tap-target floor.
 */
import React from "react";
import { View, Text, Pressable, ScrollView, StyleProp, ViewStyle } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Card } from "~/components/ui";
import { FIN_PERIODS, finAUD, type Period } from "~/data/finance";

export const Seg: React.FC<{ label: string; on: boolean; onPress: () => void; count?: number }> = ({ label, on, onPress, count }) => {
  const { theme } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderBottomWidth: 2, borderColor: on ? theme.brand.gold : "transparent" }}
    >
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 10.5, color: on ? theme.brand.gold : theme.ink.tertiary }}>{label}</Text>
      {count != null ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: on ? theme.brand.gold : theme.surface.inset }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: on ? theme.ink.inverse : theme.ink.tertiary }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

/** A horizontally scrollable row of segment tabs. */
export const SegBar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTokens();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: theme.border.subtle }}>{children}</View>
    </ScrollView>
  );
};

/** Chip — used for period selection and category pickers. */
export const Chip: React.FC<{ label: string; on: boolean; onPress: () => void }> = ({ label, on, onPress }) => {
  const { theme, radius } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.xs, borderWidth: 1, borderColor: on ? theme.border.gold : theme.border.subtle, backgroundColor: on ? theme.brand.goldMuted : theme.surface.raised }}
    >
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11.5, letterSpacing: 0.4, color: on ? theme.brand.gold : theme.ink.secondary }}>{label}</Text>
    </Pressable>
  );
};

/** FY · quarters · months selector. */
export const PeriodBar: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({ value, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
    {[FIN_PERIODS.fy, ...FIN_PERIODS.quarters, ...FIN_PERIODS.months].map((p) => (
      <Chip key={p.key} label={p.short} on={p.key === value.key} onPress={() => onChange(p)} />
    ))}
  </ScrollView>
);

export const Panel: React.FC<{ title: string; note?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ title, note, children, style }) => {
  const { theme } = useTokens();
  return (
    <Card style={[{ padding: 18 }, style]}>
      <Eyebrow>{title}</Eyebrow>
      {note ? (
        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, lineHeight: 19, color: theme.ink.tertiary, marginTop: 6 }}>{note}</Text>
      ) : null}
      <View style={{ marginTop: 14 }}>{children}</View>
    </Card>
  );
};

/** Statement row — label left, money right. `strong` promotes it to a total. */
export const RptRow: React.FC<{ label: string; value: number; strong?: boolean; gold?: boolean; neg?: boolean }> = ({ label, value, strong, gold, neg }) => {
  const { theme } = useTokens();
  const { fs } = useResponsive();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, paddingVertical: strong ? 12 : 8, borderBottomWidth: strong ? 0 : 1, borderColor: theme.border.subtle }}>
      <Text
        style={{
          flex: 1, minWidth: 0,
          fontFamily: strong ? "Inter_600SemiBold" : "Inter_400Regular",
          fontSize: fs(strong ? 11 : 12.5),
          lineHeight: fs(strong ? 11 : 12.5) * 1.5,
          letterSpacing: strong ? 1.2 : 0,
          textTransform: strong ? "uppercase" : "none",
          color: strong ? theme.ink.primary : theme.ink.secondary,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: strong ? "CormorantGaramond_600SemiBold" : "JetBrainsMono_400Regular", fontSize: fs(strong ? 16 : 12), color: gold ? theme.brand.gold : theme.ink.primary }}>
        {neg ? `(${finAUD(Math.abs(value))})` : finAUD(value)}
      </Text>
    </View>
  );
};

/** BAS worksheet row — statutory label code, description, amount. */
export const BasRow: React.FC<{ code: string; label: string; value: number; strong?: boolean; note?: string }> = ({ code, label, value, strong, note }) => {
  const { theme } = useTokens();
  const { fs } = useResponsive();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
      <Text style={{ width: 40, fontFamily: "JetBrainsMono_400Regular", fontSize: 11, letterSpacing: 0.8, color: theme.brand.gold }}>{code}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: strong ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: fs(12.5), lineHeight: fs(12.5) * 1.45, color: theme.ink.primary }}>{label}</Text>
        {note ? (
          <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 12, lineHeight: 17, color: theme.ink.tertiary, marginTop: 3 }}>{note}</Text>
        ) : null}
      </View>
      <Text style={{ fontFamily: strong ? "CormorantGaramond_600SemiBold" : "JetBrainsMono_400Regular", fontSize: fs(strong ? 16 : 12), color: strong ? theme.brand.gold : theme.ink.primary }}>{finAUD(value)}</Text>
    </View>
  );
};

/** Small italic footnote used under registers and statements. */
export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTokens();
  return (
    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, lineHeight: 20, color: theme.ink.tertiary }}>{children}</Text>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 10.5, color }) => {
  const { theme } = useTokens();
  return <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: size, color: color ?? theme.ink.tertiary }}>{children}</Text>;
};
