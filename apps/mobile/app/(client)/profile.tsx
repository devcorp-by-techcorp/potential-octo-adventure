/**
 * Client profile — identity header, event facts grid, documents list.
 * The facts grid reflows from 1→N columns by width.
 */
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Card, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { CLIENT } from "~/data/seed";
import { usePortal } from "~/state/portal";

const FACTS = [
  { k: "Event", v: "Wedding" },
  { k: "Date", v: "14 Jun 2026" },
  { k: "Venue", v: "Yarra Valley" },
  { k: "Package", v: "Signature" },
];

export default function Profile() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const { docs, inbox } = usePortal();
  const factCols = width >= 720 ? 4 : width >= 420 ? 2 : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <Card style={{ padding: fs(22), flexDirection: "row", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: theme.border.gold, alignItems: "center", justifyContent: "center", backgroundColor: theme.brand.goldMuted }}>
          <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 24, color: theme.brand.gold }}>{CLIENT.short}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Eyebrow>Client since 2026</Eyebrow>
          <Display size={30}>Eleanor & James Whitfield</Display>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 12, color: theme.ink.tertiary, marginTop: 4 }}>{CLIENT.email}</Text>
        </View>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {FACTS.map((f) => (
          <Card key={f.k} style={{ width: factCols === 1 ? "100%" : undefined, flexGrow: 1, flexBasis: factCols === 1 ? "100%" : 160, padding: 16 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary }}>{f.k}</Text>
            <Display size={19} style={{ marginTop: 4 }}>{f.v}</Display>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Button label={`Your documents (${docs.length})`} icon="doc" variant="ghost" onPress={() => router.replace("/(client)/documents")} />
        <Button label={`Inbox (${inbox.length})`} icon="inbox" variant="ghost" onPress={() => router.replace("/(client)/inbox")} />
      </View>
    </ScrollView>
  );
}
