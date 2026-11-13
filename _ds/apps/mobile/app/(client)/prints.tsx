/**
 * Print collection — the composed gallery wall plus fine-art print sizes.
 * Gallery-type viewing, so lights-out is allowed here (same `darkAllowed`
 * gate as the gallery screen): dark on focus, light on blur.
 * The wall is a measured-column masonry: items are dealt into N column
 * stacks, N deriving from width (RN has no CSS multi-column).
 */
import React, { useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Button } from "~/components/ui";
import { PROOFS, WALL_IDS, PRINT_SIZES, proofUri, money } from "~/data/seed";

export default function Prints() {
  const { theme, setName, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    setName("dark");
    return () => setName("light");
  }, [setName]));

  const frames = WALL_IDS.map((id) => PROOFS.find((p) => p.id === id)).filter(Boolean) as typeof PROOFS;
  const cols = width < 460 ? 1 : width < 900 ? 2 : 3;
  const gap = 10;
  const colW = (width - gutter * 2 - gap * (cols - 1)) / cols;
  const stacks: (typeof frames)[] = Array.from({ length: cols }, () => []);
  frames.forEach((f, i) => stacks[i % cols].push(f));
  const sizeCols = width >= 760 ? 4 : width >= 420 ? 2 : 1;

  return (
    <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View>
        <Eyebrow>Print collection · featured frames</Eyebrow>
        <Display size={48} style={{ marginTop: 10, marginBottom: 8 }}>Your gallery wall</Display>
        <Body muted style={{ maxWidth: 560 }}>
          A wall of frames from your day, sized for fine-art print. Each is available in archival giclée up to 60×90 cm.
        </Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <Button label="Order prints" icon="image" />
          <Button label="Back to gallery" variant="ghost" onPress={() => router.replace("/(client)/gallery")} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap }}>
        {stacks.map((stack, ci) => (
          <View key={ci} style={{ width: colW, gap }}>
            {stack.map((p) => (
              <View key={p.id} style={{ borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 2, overflow: "hidden", backgroundColor: theme.surface.inset }}>
                <Image source={{ uri: proofUri(p.pid) }} style={{ width: "100%", aspectRatio: p.ratio }} contentFit="cover" transition={200} />
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, gap: 2, backgroundColor: "rgba(10,10,10,0.62)" }}>
                  <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: "#f0dba8" }}>{p.label}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10.5, color: "rgba(244,235,217,0.82)" }}>Available as fine-art print</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Card style={{ padding: fs(20) }}>
        <Eyebrow>Print sizes</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 14 }}>
          {PRINT_SIZES.map((s) => (
            <View
              key={s.label}
              style={{
                flexGrow: 1, flexBasis: sizeCols === 1 ? "100%" : 150, minWidth: 0,
                paddingLeft: 16, borderLeftWidth: 1, borderColor: s.highlight ? theme.border.gold : theme.border.default,
              }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.8, fontSize: 9, color: s.highlight ? theme.brand.gold : theme.ink.tertiary }}>{s.label}</Text>
              <Display size={20} style={{ marginTop: 4 }}>{s.dims}</Display>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(14), color: theme.brand.gold, marginTop: 2, fontVariant: ["tabular-nums"] }}>from {money(s.from)}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 16, color: theme.ink.tertiary, marginTop: 4 }}>{s.desc}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
