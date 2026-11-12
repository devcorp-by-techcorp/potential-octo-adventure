/**
 * Client home — celebration hero + countdown, phase tracker, quick access.
 * Hero splits to two columns when width allows, stacks otherwise.
 */
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { useLuma } from "~/components/Luma";
import { usePortal } from "~/state/portal";
import { Eyebrow, Display, Body, Card, Button } from "~/components/ui";
import { Icon, IconName } from "~/components/Icon";
import { CLIENT, PHASES, daysUntil } from "~/data/seed";

export default function Home() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const luma = useLuma();
  const { unread, inbox } = usePortal();
  const twoCol = width >= 620;
  const quick: { title: string; sub: string; icon: IconName; href?: string; luma?: boolean }[] = [
    { title: "Your gallery", sub: "248 frames · select favourites", icon: "image", href: "/(client)/gallery" },
    { title: "Inbox", sub: unread > 0 ? `${unread} awaiting your signature` : "Correspondence from the studio", icon: "inbox", href: "/(client)/inbox" },
    { title: "Print collection", sub: "Frames sized for fine-art print", icon: "gallery", href: "/(client)/prints" },
    { title: "Pre-shoot intake", sub: "Help us plan your day", icon: "clipboard", href: "/(client)/intake" },
  ];
  const qCols = width >= 720 ? 4 : width >= 440 ? 2 : 1;

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      {/* Hero */}
      <Card style={{ overflow: "hidden" }}>
        <View style={{ padding: fs(24), flexDirection: twoCol ? "row" : "column", gap: space.s5, alignItems: twoCol ? "center" : "stretch" }}>
          <View style={{ flex: twoCol ? 1.4 : undefined }}>
            <Eyebrow>Your celebration</Eyebrow>
            <Display size={40} style={{ marginTop: 6, marginBottom: 6 }}>Eleanor & James</Display>
            <Body muted>{CLIENT.eventType} · {CLIENT.venue}</Body>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              <Button label="View gallery" icon="gallery" onPress={() => router.replace("/(client)/gallery")} />
              <Button label="Ask Luma" icon="sparkle" variant="ghost" onPress={luma.open} />
            </View>
          </View>
          <View style={{ flex: twoCol ? 1 : undefined, borderWidth: 1, borderColor: theme.border.gold, borderRadius: radius.xs, padding: fs(20), backgroundColor: theme.surface.raised }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 2, fontSize: 9, color: theme.ink.tertiary }}>Countdown</Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(60), lineHeight: fs(60), color: theme.brand.gold }}>{daysUntil(CLIENT.eventDate)}</Text>
            <Body muted>days · 14 June 2026</Body>
          </View>
        </View>
      </Card>

      {/* Phase tracker */}
      <View>
        <Eyebrow>Where you are</Eyebrow>
        <Card style={{ marginTop: 12, padding: fs(20) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <Display size={24}>{PHASES[CLIENT.phaseIdx].label}</Display>
            <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.brand.gold }}>Step {CLIENT.phaseIdx + 1} of 8</Text>
          </View>
          <Body muted style={{ marginTop: 6, marginBottom: 16 }}>{PHASES[CLIENT.phaseIdx].description}</Body>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {PHASES.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < CLIENT.phaseIdx ? theme.brand.gold : i === CLIENT.phaseIdx ? theme.brand.goldHover : theme.border.default }} />
            ))}
          </View>
        </Card>
      </View>

      {/* Quick access */}
      <View>
        <Eyebrow>Quick access</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {quick.map((q) => (
            <Card key={q.title} style={{ width: qCols === 1 ? "100%" : `${100 / qCols}%`, flexGrow: 1, flexBasis: 150, padding: 16, minHeight: 112 }}>
              <View style={{ gap: 10 }}>
                <Icon name={q.icon} size={20} color={theme.brand.gold} />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary }}>{q.title}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: fs(11.5), lineHeight: fs(11.5) * 1.4, color: theme.ink.tertiary }}>{q.sub}</Text>
              </View>
              <Button label="Open" variant="ghost" style={{ marginTop: 12 }} onPress={() => (q.luma ? luma.open() : q.href && router.replace(q.href as any))} />
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
