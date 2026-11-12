/**
 * Illuminate Kids UI kit — the Kids branch's own visual grammar: cream ground,
 * ink borders, hard offset shadows, pills and soft radii, with green and gold
 * accents. Same brand mark as Illuminate Studios, with the "Kids" tag.
 *
 * Used by the public Kids site, the organisation portal and parent
 * registration. The studio's Kids workspace does NOT use this kit — it follows
 * the studio design system like every other admin surface.
 */
import React from "react";
import {
  View, Text, Pressable, TextInput, Modal, ScrollView, Image, Platform, KeyboardAvoidingView,
  type StyleProp, type ViewStyle, type TextStyle, type KeyboardTypeOptions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { K } from "~/data/kids";

export const KF = {
  display: "CormorantGaramond_700Bold",
  displayItalic: "CormorantGaramond_600SemiBold_Italic",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  wordmark: "Cinzel_600SemiBold",
} as const;

const LENS = require("../../../assets/images/lens-gold.png");

/** The rotated "Kids" tag that sits beside the Illuminate wordmark. */
export const KidsTag: React.FC<{ small?: boolean }> = ({ small }) => (
  <View style={{ transform: [{ rotate: "-5deg" }], paddingHorizontal: small ? 8 : 9, paddingTop: small ? 2 : 3, paddingBottom: small ? 3 : 4, borderRadius: small ? 8 : 9, backgroundColor: K.green, borderWidth: 2, borderColor: K.gold }}>
    <Text style={{ fontFamily: KF.bold, fontSize: small ? 11 : 12, letterSpacing: 0.5, color: K.ink }}>Kids</Text>
  </View>
);

/** Dark brand bar with the green rule. Tapping the mark returns to the Kids home. */
export const KidsHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: insets.top + 8, paddingBottom: 8, backgroundColor: K.dark, borderBottomWidth: 3, borderBottomColor: K.green }}>
      <Pressable onPress={() => router.replace("/kids")} accessibilityRole="link" accessibilityLabel="Illuminate Kids home"
        style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={LENS} resizeMode="contain" style={{ width: 28, height: 28 }} />
        <Text numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, fontFamily: KF.wordmark, fontSize: 11.5, letterSpacing: 2.3, color: K.cream }}>ILLUMINATE STUDIOS</Text>
        <KidsTag />
      </Pressable>
      {children}
    </View>
  );
};

export const KEyebrow: React.FC<{ children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }> = ({ children, color = K.faint, style }) => (
  <Text style={[{ fontFamily: KF.mono, fontSize: 11, letterSpacing: 1.8, textTransform: "uppercase", color }, style]}>{children}</Text>
);

export const KLabel: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = K.body }) => (
  <Text style={{ fontFamily: KF.semi, fontSize: 12, letterSpacing: 0.7, textTransform: "uppercase", color }}>{children}</Text>
);

export const KTitle: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }> = ({ children, size = 28, color = K.ink, style }) => (
  <Text style={[{ fontFamily: KF.display, fontSize: size, lineHeight: size * 1.05, color }, style]}>{children}</Text>
);

export const KBody: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }> = ({ children, size = 15, color = K.body, style }) => (
  <Text style={[{ fontFamily: KF.body, fontSize: size, lineHeight: size * 1.6, color }, style]}>{children}</Text>
);

type PillVariant = "dark" | "gold" | "outline" | "dashed" | "text" | "danger";
export const KButton: React.FC<{
  label: string; onPress?: () => void; variant?: PillVariant; height?: number; full?: boolean;
  icon?: React.ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}> = ({ label, onPress, variant = "dark", height = 48, full, icon, style, accessibilityLabel }) => {
  const filled = variant === "dark" || variant === "gold";
  const bare = variant === "text" || variant === "danger";
  const fg = variant === "dark" ? K.ground : variant === "danger" ? K.error : variant === "text" ? K.greenLink : K.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [{
        minHeight: Math.max(44, height), paddingHorizontal: bare ? 6 : 20, borderRadius: 999,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        alignSelf: full ? "stretch" : "flex-start",
        backgroundColor: variant === "dark" ? K.ink : variant === "gold" ? K.gold : "transparent",
        borderWidth: filled || bare ? 0 : 2, borderColor: K.ink, borderStyle: variant === "dashed" ? "dashed" : "solid",
        opacity: pressed ? 0.8 : 1,
      }, style]}>
      {icon}
      <Text style={{ fontFamily: bare ? KF.semi : KF.bold, fontSize: bare ? 13.5 : 14, color: fg, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
};

/** A card with the Kids hard offset shadow, drawn as a solid block so it is identical on iOS, Android and web. */
export const KShadowCard: React.FC<{
  children: React.ReactNode; accent?: string; offset?: number; radius?: number; tilt?: string;
  style?: StyleProp<ViewStyle>; outer?: StyleProp<ViewStyle>;
}> = ({ children, accent = K.green, offset = 6, radius = 28, tilt, style, outer }) => (
  <View style={[{ paddingRight: offset, paddingBottom: offset }, tilt ? { transform: [{ rotate: tilt }] } : null, outer]}>
    <View style={{ position: "absolute", left: offset, top: offset, right: 0, bottom: 0, borderRadius: radius, backgroundColor: accent }} />
    <View style={[{ backgroundColor: K.card, borderWidth: 2, borderColor: K.ink, borderRadius: radius, padding: 22, gap: 12 }, style]}>
      {children}
    </View>
  </View>
);

export const KCard: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }> = ({ children, style, strong }) => (
  <View style={[{ backgroundColor: K.card, borderWidth: strong ? 2 : 1.5, borderColor: strong ? K.ink : K.line, borderRadius: 24, padding: 20, gap: 12 }, style]}>{children}</View>
);

export const KField: React.FC<{
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
  keyboardType?: KeyboardTypeOptions; autoCapitalize?: "none" | "words" | "characters" | "sentences";
  mono?: boolean; onSubmit?: () => void; style?: StyleProp<ViewStyle>;
}> = ({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, mono, onSubmit, style }) => (
  <View style={[{ gap: 6 }, style]}>
    <KLabel>{label}</KLabel>
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a39a88"
      keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false}
      onSubmitEditing={onSubmit} returnKeyType={onSubmit ? "done" : undefined} accessibilityLabel={label}
      style={mono
        ? { minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: "rgba(22,19,14,0.2)", borderRadius: 16, backgroundColor: K.white, fontFamily: KF.mono, fontSize: 20, letterSpacing: 2.4, color: K.ink }
        : { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: K.lineStrong, borderRadius: 12, backgroundColor: K.white, fontFamily: KF.body, fontSize: 15, color: K.ink }}
    />
  </View>
);

/** Compact unlabelled input for inline add-rows. */
export const KInput: React.FC<{ value: string; onChangeText: (t: string) => void; placeholder: string; onSubmit?: () => void; style?: StyleProp<ViewStyle>; pill?: boolean }> =
  ({ value, onChangeText, placeholder, onSubmit, style, pill }) => (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a39a88"
      accessibilityLabel={placeholder} onSubmitEditing={onSubmit} returnKeyType={onSubmit ? "done" : undefined} autoCorrect={false}
      style={[{ minWidth: 0, minHeight: pill ? 46 : 44, paddingVertical: 10, paddingHorizontal: pill ? 14 : 12, borderWidth: 1.5, borderColor: K.lineStrong, borderRadius: pill ? 999 : 12, backgroundColor: K.white, fontFamily: KF.body, fontSize: 14.5, color: K.ink }, style as StyleProp<TextStyle>]} />
  );

export const KAlert: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View accessibilityRole="alert" style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: K.errorBg }}>
    <Text style={{ fontFamily: KF.body, fontSize: 14, lineHeight: 21, color: K.error }}>{children}</Text>
  </View>
);

/** Selectable pill chip (type pickers, kind pickers, tabs). */
export const KChip: React.FC<{ label: string; on: boolean; onPress: () => void; strong?: boolean; badge?: number; onColor?: string; offColor?: string }> =
  ({ label, on, onPress, strong, badge, onColor = K.green, offColor = K.white }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ minHeight: 44, paddingHorizontal: strong ? 16 : 14, borderRadius: 999, borderWidth: strong ? 2 : 1.5, borderColor: on || strong ? K.ink : K.lineStrong, backgroundColor: on ? onColor : offColor, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontFamily: strong ? KF.bold : KF.semi, fontSize: strong ? 13.5 : 13, color: K.ink }}>{label}</Text>
      {badge ? (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 999, backgroundColor: K.gold, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: KF.bold, fontSize: 11.5, color: K.ink }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );

export const KTagPill: React.FC<{ label: string; bg?: string; mono?: boolean; border?: string }> = ({ label, bg = K.green, mono, border }) => (
  <View style={{ alignSelf: "flex-start", paddingVertical: mono ? 3 : 4, paddingHorizontal: mono ? 9 : 12, borderRadius: mono ? 8 : 999, backgroundColor: bg, borderWidth: border ? 1.5 : 0, borderColor: border }}>
    <Text style={{ fontFamily: mono ? KF.mono : KF.bold, fontSize: 12, color: K.ink }}>{label}</Text>
  </View>
);

/** Consent switch row. The whole row is the control; state is announced as a switch. */
export const KSwitchRow: React.FC<{ label: string; sub: string; on: boolean; onToggle: () => void }> = ({ label, sub, on, onToggle }) => (
  <Pressable onPress={onToggle} accessibilityRole="switch" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label}
    style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: "rgba(22,19,14,0.12)", borderRadius: 16, backgroundColor: K.white }}>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text style={{ fontFamily: KF.semi, fontSize: 14.5, color: K.ink }}>{label}</Text>
      <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19, color: K.muted }}>{sub}</Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ width: 26, textAlign: "right", fontFamily: KF.bold, fontSize: 12, color: K.body }}>{on ? "Yes" : "No"}</Text>
      <View style={{ width: 46, height: 26, borderRadius: 999, backgroundColor: on ? K.green : "#d9d1c2", justifyContent: "center" }}>
        <View style={{ position: "absolute", left: on ? 22 : 2, width: 22, height: 22, borderRadius: 11, backgroundColor: K.white, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
      </View>
    </View>
  </Pressable>
);

export const KCheckRow: React.FC<{ on: boolean; onToggle: () => void; children: React.ReactNode; highlight?: boolean; label: string }> = ({ on, onToggle, children, highlight, label }) => (
  <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label}
    style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 52, paddingVertical: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: highlight && on ? K.ink : K.line, borderRadius: 16, backgroundColor: K.card }}>
    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: K.ink, backgroundColor: on ? K.green : K.white, alignItems: "center", justifyContent: "center" }}>
      {on ? <Text style={{ fontFamily: KF.bold, fontSize: 14, lineHeight: 17, color: K.ink }}>✓</Text> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{children}</View>
  </Pressable>
);

/** Bottom sheet on a handset, centred panel when there is width. */
export const KSheet: React.FC<{
  visible: boolean; onClose: () => void; title?: string; maxWidth?: number; children: React.ReactNode;
  center?: boolean; dismissable?: boolean; header?: React.ReactNode; fill?: boolean; scroll?: boolean;
}> = ({ visible, onClose, title, maxWidth = 640, children, center, dismissable = true, header, fill, scroll = true }) => {
  const insets = useSafeAreaInsets();
  const body = scroll
    ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: header ? 0 : 22, paddingBottom: insets.bottom + 24, gap: 14 }}>{title ? <SheetTitle title={title} onClose={onClose} /> : null}{children}</ScrollView>
    : <View style={{ flex: 1 }}>{children}</View>;
  return (
    <Modal visible={visible} transparent animationType={center ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: "rgba(22,19,14,0.5)", justifyContent: center ? "center" : "flex-end", alignItems: "center", padding: center ? 16 : 0 }}>
          <Pressable onPress={() => {}} accessibilityViewIsModal
            style={[{ width: "100%", maxWidth, maxHeight: center ? "90%" : "92%", backgroundColor: K.ground, overflow: "hidden" },
              center ? { borderRadius: 28, borderWidth: 2, borderColor: K.ink } : { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
              fill ? { height: "88%", maxHeight: 640 } : null]}>
            {header}
            {body}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const SheetTitle: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
    <KTitle size={28} style={{ flex: 1 }}>{title}</KTitle>
    <KRoundClose onPress={onClose} />
  </View>
);

export const KRoundClose: React.FC<{ onPress: () => void; dark?: boolean }> = ({ onPress, dark }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Close"
    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: dark ? K.darkPanel : "#e9e1d2", alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontSize: 22, lineHeight: 24, color: dark ? K.cream : K.ink }}>×</Text>
  </Pressable>
);

/** A dropdown: the field shows the current choice; tapping opens the option list. */
export function KSelect<T extends string>({ label, value, options, onChange, placeholder }: {
  label: string; value: T | ""; options: { value: T; label: string }[]; onChange: (v: T) => void; placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <KLabel>{label}</KLabel>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${current ? current.label : placeholder ?? "choose"}`}
        style={{ minHeight: 50, paddingHorizontal: 14, borderWidth: 1.5, borderColor: K.lineStrong, borderRadius: 12, backgroundColor: K.white, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: KF.body, fontSize: 15, color: current ? K.ink : "#a39a88" }}>{current ? current.label : placeholder ?? "Choose"}</Text>
        <Text style={{ fontSize: 12, color: K.muted }}>▼</Text>
      </Pressable>
      <KSheet visible={open} onClose={() => setOpen(false)} title={label} maxWidth={520}>
        <View style={{ gap: 8 }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ minHeight: 52, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: on ? 2 : 1.5, borderColor: on ? K.ink : K.line, backgroundColor: on ? K.greenTint : K.card, justifyContent: "center" }}>
                <Text style={{ fontFamily: on ? KF.semi : KF.body, fontSize: 15, color: K.ink }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </KSheet>
    </View>
  );
}

/** Placeholder for an approved image. Children's images are never bundled; the studio supplies consent-cleared imagery. */
export const KImageSlot: React.FC<{ label: string; bg: string; style?: StyleProp<ViewStyle> }> = ({ label, bg, style }) => (
  <View accessibilityLabel={label + " placeholder"} style={[{ backgroundColor: bg, alignItems: "center", justifyContent: "center", padding: 12, overflow: "hidden", borderWidth: 6, borderColor: K.card }, style]}>
    <Text style={{ fontFamily: KF.mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center", color: K.faint }}>{label}</Text>
  </View>
);

/** Luma's four-point spark. */
export const KSpark: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = K.ink }) => (
  <Text style={{ fontSize: size, lineHeight: size + 2, color }}>✦</Text>
);
