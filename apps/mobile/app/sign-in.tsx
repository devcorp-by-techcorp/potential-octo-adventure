/**
 * Sign-in — split-screen (photographic panel + form). Stacks to a single
 * column on compact / portrait; side-by-side on wide landscape. Role toggle
 * routes into the client vs studio-admin portal.
 */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { useSession } from "~/state/session";
import type { Role } from "~/state/session";
import { Eyebrow, Display, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { LogoBanner } from "~/components/Logo";

const HERO = "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format&fit=crop";

export default function SignIn() {
  const { theme, radius } = useTokens();
  const { width, height, orientation } = useResponsive();
  const insets = useSafeAreaInsets();
  const { signIn, message } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<Role>(params.role === "staff" ? "staff" : "client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownError = error ?? message;

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await signIn(role, email, password);
      if (r.ok) router.replace(role === "staff" ? "/(admin)/dashboard" : "/(client)/home");
      else setError(r.error);
    } finally {
      setPending(false);
    }
  };

  const webBase = process.env.EXPO_PUBLIC_WEB_URL ?? (Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "");

  // Side-by-side only when there is genuine landscape width to spare.
  const sideBySide = width >= 900 && orientation === "landscape";

  const hero = (
    <View style={{ flex: sideBySide ? 1 : undefined, height: sideBySide ? undefined : Math.max(220, height * 0.32), backgroundColor: "#0a0a0a" }}>
      <Image source={{ uri: HERO }} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.6 }} contentFit="cover" />
      <View style={{ flex: 1, justifyContent: "flex-end", padding: 28, paddingTop: insets.top + 28 }}>
        <LogoBanner height={26} variant="onDark" />
        <View style={{ marginTop: 16 }}>
        <Eyebrow color="#c9a96e">Illuminate Studios</Eyebrow>
        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 32, lineHeight: 34, color: "#f4ebd9", marginTop: 6, maxWidth: 340 }}>
          Every frame, from first enquiry to delivered gallery.
        </Text>
        </View>
      </View>
    </View>
  );

  const form = (
    <ScrollView style={{ flex: sideBySide ? 1 : undefined }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28, backgroundColor: theme.surface.canvas }}>
      <View style={{ width: "100%", maxWidth: 380, alignSelf: "center" }}>
        <Eyebrow>Welcome back</Eyebrow>
        <Display size={34} style={{ marginTop: 6, marginBottom: 22 }}>Sign in</Display>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
          {(["client", "staff"] as Role[]).map((r) => {
            const on = role === r;
            return (
              <Pressable key={r} onPress={() => setRole(r)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 46, borderRadius: radius.xs, alignItems: "center", justifyContent: "center", backgroundColor: on ? theme.brand.gold : "transparent", borderWidth: 1, borderColor: on ? theme.brand.gold : theme.border.default }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, fontSize: 11, color: on ? theme.ink.inverse : theme.ink.secondary }}>{r === "staff" ? "Studio" : "Client"}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} onSubmit={submit} />
        <Field label="Password" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmit={submit} />

        {shownError ? (
          <Text accessibilityRole="alert" style={{ fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 19, color: theme.status.danger, marginBottom: 10 }}>{shownError}</Text>
        ) : null}

        <Button label={`Enter ${role === "staff" ? "studio" : "client"} portal`} icon="arrow" fullWidth style={{ marginTop: 8 }} busy={pending} onPress={submit} />

        <Pressable onPress={() => Linking.openURL(`${webBase}/client`)} accessibilityRole="link" style={{ minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, color: theme.brand.gold }}>Forgotten password?</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/marketing")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, color: theme.ink.secondary }}>← Back to the studio site</Text>
        </Pressable>

      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, flexDirection: sideBySide ? "row" : "column", backgroundColor: theme.surface.canvas }}>
      {hero}
      {form}
    </View>
  );
}

function Field({ label, value, onChangeText, onSubmit, ...rest }: { label: string; value: string; onChangeText: (t: string) => void; onSubmit: () => void } & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText" | "onSubmitEditing">) {
  const { theme, radius } = useTokens();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: theme.ink.secondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        accessibilityLabel={label}
        placeholderTextColor={theme.ink.tertiary}
        style={{ minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, fontFamily: "Inter_400Regular", fontSize: 15, color: theme.ink.primary }}
      />
    </View>
  );
}
