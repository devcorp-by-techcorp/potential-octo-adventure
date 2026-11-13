/**
 * Root layout — providers, fonts, and the top-level Stack.
 * Order matters: SafeAreaProvider → Theme → Session → Studio → Portal → Luma → Stack.
 * Studio sits above Luma and the shell: both address the user by the identity
 * held in Site Content.
 */
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { CormorantGaramond_500Medium, CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { Cinzel_600SemiBold } from "@expo-google-fonts/cinzel";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import { ThemeProvider } from "~/theme/ThemeProvider";
import { SessionProvider } from "~/state/session";
import { StudioProvider } from "~/state/studio";
import { PortalProvider } from "~/state/portal";
import { LumaProvider } from "~/components/Luma";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    CormorantGaramond_500Medium, CormorantGaramond_600SemiBold,
    Cinzel_600SemiBold, JetBrainsMono_400Regular,
  });

  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <StudioProvider>
            <PortalProvider>
              <LumaProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
              </LumaProvider>
            </PortalProvider>
          </StudioProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
