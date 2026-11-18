/**
 * Guards a route group. Never renders its children until the session is
 * known to match the required role, so seeded data cannot flash while
 * restoring.
 */
import React, { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useSession } from "~/state/session";
import { Button } from "~/components/ui";

export function Splash() {
  const { theme } = useTokens();
  return (
    <View accessibilityLabel="Loading" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface.canvas }}>
      <ActivityIndicator color={theme.brand.gold} />
    </View>
  );
}

export function RetryPanel() {
  const { theme } = useTokens();
  const { restore } = useSession();
  const [busy, setBusy] = useState(false);
  const retry = async () => { setBusy(true); try { await restore(); } finally { setBusy(false); } };
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14, backgroundColor: theme.surface.canvas }}>
      <Text accessibilityRole="alert" style={{ fontFamily: "Inter_500Medium", fontSize: 15, textAlign: "center", color: theme.ink.primary }}>
        The studio is temporarily unavailable. Please try again.
      </Text>
      <Button label="Try again" onPress={retry} busy={busy} />
    </View>
  );
}

export function SessionGate({ require, children }: { require: "staff" | "client"; children: React.ReactNode }) {
  const { status, signingOut } = useSession();
  // While signing out, show nothing live: the caller navigates away once signOut() resolves.
  if (status === "restoring" || signingOut) return <Splash />;
  if (status === "unavailable") return <RetryPanel />;
  if (status === "signed-out") return <Redirect href={`/sign-in?role=${require}` as any} />;
  if (status !== require) return <Redirect href={status === "staff" ? "/(admin)/dashboard" : "/(client)/home"} />;
  return <>{children}</>;
}
