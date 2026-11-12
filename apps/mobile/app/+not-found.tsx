import { View, Text } from "react-native";
import { Link, Stack } from "expo-router";
import { useTokens } from "~/theme/useTokens";

export default function NotFound() {
  const { theme } = useTokens();
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.surface.canvas }}>
        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 28, color: theme.ink.primary }}>This page doesn't exist.</Text>
        <Link href="/" style={{ marginTop: 12, color: theme.brand.gold, fontSize: 15 }}>Go home</Link>
      </View>
    </>
  );
}
