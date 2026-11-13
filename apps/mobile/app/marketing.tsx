/**
 * Public marketing — the first surface a visitor lands on (mobile-first).
 * Mirrors the web Marketing & pricing module: editorial hero, Selected Frames
 * reel, process, collection pricing, print-collection preview.
 *
 * Layout comes from measured geometry (useResponsive): the hero splits to two
 * columns when there is landscape width to spare, the reel is a horizontal
 * rail on every width, and the process / package grids reflow by column count.
 * Light theme only — lights-out is reserved for the gallery viewer.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { useLuma } from "~/components/Luma";
import { Eyebrow, Display, Body, Card, Button, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { LogoBanner, LogoMark } from "~/components/Logo";
import { MARKETING, PROCESS, PACKAGES, PROOFS, proofUri } from "~/data/seed";
import { K } from "~/data/kids";
import { EnquirySheet } from "~/components/EnquirySheet";
import { KidsTag } from "~/components/kids/parts";

const HERO = proofUri(PROOFS[2].pid, 1400);

export default function Marketing() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width, height, orientation, isWide } = useResponsive();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const luma = useLuma();

  const heroSplit = width >= 900 && orientation === "landscape";
  const heroH = heroSplit ? Math.max(320, height - insets.top - 56) : Math.max(300, Math.min(520, height * 0.56));
  const reelW = Math.round(Math.min(320, Math.max(200, width * 0.68)));
  const procCols = width >= 940 ? 4 : width >= 560 ? 2 : 1;
  const pkgCols = width >= 1000 ? 3 : width >= 660 ? 2 : 1;
  const pct = (n: number) => (n === 1 ? "100%" : (`${100 / n}%` as const));

  // "Begin an enquiry" sheet; a collection card opens it with that collection preselected.
  const [enquiry, setEnquiry] = React.useState<{ open: boolean; pkg: string | null }>({ open: false, pkg: null });
  const beginEnquiry = (pkg: string | null = null) => setEnquiry({ open: true, pkg });

  const heroCopy = (
    <View style={{ flex: heroSplit ? 1 : undefined, justifyContent: "flex-end", padding: fs(26), paddingTop: heroSplit ? fs(26) : insets.top + fs(70), gap: 10 }}>
      <LogoBanner height={24} variant="onDark" />
      <Eyebrow color="#c9a96e">{MARKETING.place}</Eyebrow>
      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(heroSplit ? 46 : 40), lineHeight: fs(heroSplit ? 48 : 42), letterSpacing: -0.4, color: "#f4ebd9", maxWidth: 520 }}>
        {MARKETING.headline}
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: fs(13.5), lineHeight: fs(13.5) * 1.6, color: "rgba(244,235,217,0.78)", maxWidth: 460 }}>
        {MARKETING.lede}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        <Button label="Begin an enquiry" icon="calendar" onPress={() => beginEnquiry()} />
        <Pressable onPress={luma.open} accessibilityRole="button"
          style={{ minHeight: 44, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.xs, borderWidth: 1, borderColor: "rgba(201,169,110,0.55)", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="sparkle" size={16} color="#c9a96e" />
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(11), color: "#c9a96e" }}>Ask Luma</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/sign-in")}
          accessibilityRole="button"
          style={{ minHeight: 44, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.xs, borderWidth: 1, borderColor: "rgba(201,169,110,0.55)", flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Icon name="lock" size={16} color="#c9a96e" />
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(11), color: "#c9a96e" }}>Client sign-in</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }}>
      {/* Solid marketing bar — never glass (DS navigation rule) */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: insets.top + 8, paddingBottom: 8, backgroundColor: "#0a0a0a", borderBottomWidth: 1, borderColor: "rgba(201,169,110,0.22)" }}>
        <LogoMark size={26} variant="onDark" />
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontFamily: "Cinzel_600SemiBold", fontSize: fs(11.5), letterSpacing: 2.4, color: "#f4ebd9" }}>
          ILLUMINATE STUDIOS
        </Text>
        {width >= 560 ? (
          <Pressable onPress={() => beginEnquiry()} accessibilityRole="button" style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(201,169,110,0.55)", borderRadius: radius.xs }}>
            <Icon name="calendar" size={15} color="#c9a96e" />
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.1, fontSize: fs(10.5), color: "#c9a96e" }}>Begin an enquiry</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/kids")} accessibilityRole="link" accessibilityLabel="Illuminate Kids" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }}>
          <KidsTag />
        </Pressable>
        <Pressable onPress={luma.open} accessibilityLabel="Ask Luma" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(201,169,110,0.4)", borderRadius: radius.xs }}>
          <Icon name="sparkle" size={19} color="#c9a96e" />
        </Pressable>
        <Pressable onPress={() => router.push("/sign-in")} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 14, backgroundColor: "#c9a96e", borderRadius: radius.xs }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.1, fontSize: fs(10.5), color: "#0a0a0a" }}>Sign in</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.s6 }}>
        {/* Hero */}
        <View style={{ height: heroSplit ? heroH : undefined, minHeight: heroSplit ? undefined : heroH, flexDirection: heroSplit ? "row" : "column", backgroundColor: "#0a0a0a" }}>
          {!heroSplit ? (
            <>
              <Image source={{ uri: HERO }} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.62 }} contentFit="cover" />
              {/* Scrim keeps the cream headline legible over any frame. */}
              <LinearGradient
                colors={["rgba(10,10,10,0.35)", "rgba(10,10,10,0.7)", "rgba(10,10,10,0.92)"]}
                style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
              />
            </>
          ) : null}
          {heroCopy}
          {heroSplit ? (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: HERO }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
          ) : null}
        </View>

        {/* Selected Frames reel */}
        <View style={{ paddingTop: space.s6, gap: 12 }}>
          <View style={{ paddingHorizontal: gutter, gap: 4 }}>
            <Eyebrow>Selected frames</Eyebrow>
            <Display size={28}>Recent work</Display>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}>
            {PROOFS.slice(0, 8).map((p) => (
              <View key={p.id} style={{ width: reelW }}>
                <Image
                  source={{ uri: proofUri(p.pid, 700) }}
                  style={{ width: "100%", aspectRatio: p.ratio, backgroundColor: theme.surface.inset, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: radius.xs }}
                  contentFit="cover"
                />
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, letterSpacing: 0.4, color: theme.ink.tertiary, marginTop: 8 }}>{p.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Process */}
        <View style={{ paddingHorizontal: gutter, paddingTop: space.s7, gap: 12 }}>
          <Eyebrow>How it runs</Eyebrow>
          <Display size={28}>From first note to delivered gallery</Display>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
            {PROCESS.map((s) => (
              <Card key={s.step} style={{ width: pct(procCols), flexGrow: 1, flexBasis: 220, padding: fs(18), gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Icon name={s.icon} size={20} color={theme.brand.gold} />
                  <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{s.step}</Text>
                </View>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(21), color: theme.ink.primary }}>{s.title}</Text>
                <Body muted size={12.5}>{s.body}</Body>
              </Card>
            ))}
          </View>
        </View>

        {/* Collections / pricing */}
        <View style={{ paddingHorizontal: gutter, paddingTop: space.s7, gap: 12 }}>
          <Eyebrow>Collections</Eyebrow>
          <Display size={28}>Three ways to work together</Display>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
            {PACKAGES.map((p) => (
              <Card key={p.name} gold={p.featured} style={{ width: pct(pkgCols), flexGrow: 1, flexBasis: 260, padding: fs(20), gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(26), color: theme.ink.primary }}>{p.name}</Text>
                  {p.featured ? <Badge label="Most chosen" tone="gold" /> : null}
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: fs(11.5), letterSpacing: 0.3, color: theme.ink.tertiary }}>{p.forWhom}</Text>
                <View style={{ height: 1, backgroundColor: theme.border.subtle }} />
                <View style={{ gap: 7 }}>
                  {p.includes.map((line) => (
                    <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <View style={{ paddingTop: 2 }}><Icon name="check" size={14} color={theme.brand.gold} /></View>
                      <Body muted size={12.5} style={{ flex: 1, minWidth: 0 }}>{line}</Body>
                    </View>
                  ))}
                </View>
                <Button label="Enquire" icon="arrow" variant={p.featured ? "primary" : "ghost"} fullWidth style={{ marginTop: 4 }} onPress={() => beginEnquiry(p.name)} />
              </Card>
            ))}
          </View>
        </View>

        {/* Illuminate Kids entry */}
        <View style={{ paddingHorizontal: gutter, paddingTop: space.s7 }}>
          <Pressable onPress={() => router.push("/kids")} accessibilityRole="link" accessibilityLabel="Visit Illuminate Kids. Photos for centres, schools and clubs."
            style={{ overflow: "hidden", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, padding: Math.max(20, gutter), borderRadius: 24, backgroundColor: K.ground, borderWidth: 2, borderColor: K.ink }}>
            <View style={{ position: "absolute", right: -50, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: K.gold, opacity: 0.3 }} />
            <View style={{ flex: 1, minWidth: 220, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 12, letterSpacing: 2.2, color: K.ink }}>ILLUMINATE</Text>
                <KidsTag small />
              </View>
              <Text style={{ fontFamily: "CormorantGaramond_700Bold", fontSize: fs(28), lineHeight: fs(30), color: K.ink }}>Photos for centres, schools and clubs</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: fs(13.5), lineHeight: fs(13.5) * 1.55, color: K.body, maxWidth: 520 }}>Early childhood centres, kindergartens, schools, sports clubs and dance schools. Parents register with their organisation's code.</Text>
            </View>
            <View style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 20, borderRadius: 999, backgroundColor: K.ink }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: K.ground }}>Visit Illuminate Kids →</Text>
            </View>
          </Pressable>
        </View>

        {/* Print collection preview */}
        <View style={{ paddingHorizontal: gutter, paddingTop: space.s7, gap: 12 }}>
          <Eyebrow>Print collection</Eyebrow>
          <Display size={28}>Frames off the screen</Display>
          <Body muted size={13} style={{ maxWidth: 560 }}>{MARKETING.printNote}</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            {PROOFS.slice(8, 11).map((p) => (
              <View key={p.id} style={{ flexGrow: 1, flexBasis: 150, width: width < 460 ? "100%" : pct(3) }}>
                <Image
                  source={{ uri: proofUri(p.pid, 600) }}
                  style={{ width: "100%", aspectRatio: 3 / 4, backgroundColor: theme.surface.inset, borderWidth: 1, borderColor: theme.border.subtle }}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: space.s7, paddingHorizontal: gutter, paddingVertical: space.s6, backgroundColor: theme.surface.inset, borderTopWidth: 1, borderColor: theme.border.subtle, gap: 12 }}>
          <View style={{ flexDirection: isWide ? "row" : "column", gap: 14, alignItems: isWide ? "center" : "flex-start", justifyContent: "space-between" }}>
            <View style={{ gap: 6, flexShrink: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 12, letterSpacing: 2.2, color: theme.ink.primary }}>ILLUMINATE STUDIOS</Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, lineHeight: 17, color: theme.ink.tertiary, flexShrink: 1 }} numberOfLines={2}>
                studio@illuminatestudios.com.au{"\n"}Collingwood · Melbourne VIC
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Button label="Begin an enquiry" icon="calendar" onPress={() => beginEnquiry()} />
              <Button label="Ask Luma" icon="sparkle" variant="ghost" onPress={luma.open} />
              <Button label="Client sign-in" icon="arrow" variant="ghost" onPress={() => router.push("/sign-in")} />
            </View>
          </View>
        </View>
      </ScrollView>
      <EnquirySheet visible={enquiry.open} initialPackage={enquiry.pkg} onClose={() => setEnquiry((e) => ({ ...e, open: false }))} />
    </View>
  );
}
