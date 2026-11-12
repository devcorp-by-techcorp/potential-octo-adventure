/**
 * Site Content — who the studio is, plus the copy and featured frames on the
 * public landing page. The identity block is the studio's single source of
 * truth: Luma greets whoever signs in by the Studio Manager name, and every
 * document, report and email signs off with these names.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput, Image } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Body, Card, Badge, Button } from "~/components/ui";
import { MARKETING, PROOFS, proofUri, INQUIRIES_FULL } from "~/data/seed";
import { useStudio, adminGreeting } from "~/state/studio";
import type { IdentityKey } from "~/data/studio";

const IDENTITY_FIELDS: ["name" | "title" | "email" | "phone", string, string][] = [
  ["name", "Full name", "e.g. Victoria Caine"],
  ["title", "Title used with clients", "Studio Manager"],
  ["email", "Email", "name@illuminatestudios.com.au"],
  ["phone", "Direct phone", "+61 3 9417 0000"],
];

const BLOCKS: [string, string, string, boolean][] = [
  ["headline", "Hero headline", MARKETING.headline, false],
  ["lede", "Hero lede", MARKETING.lede, true],
  ["place", "Location line", MARKETING.place, false],
  ["email", "Studio email", "studio@illuminatestudios.com.au", false],
  ["address", "Studio address", "Collingwood · Melbourne VIC", false],
  ["print", "Print collection note", MARKETING.printNote, true],
];

export default function SiteContent() {
  const { theme, radius, space } = useTokens();
  const { gutter, width } = useResponsive();
  const [values, setValues] = React.useState<Record<string, string>>(
    () => Object.fromEntries(BLOCKS.map(([k, , v]) => [k, v])));
  const [saved, setSaved] = React.useState<string | null>(null);
  const { identity, setIdentityField } = useStudio();
  const [identityFlash, setIdentityFlash] = React.useState<string | null>(null);
  const newInquiries = INQUIRIES_FULL.filter((q) => q.status === "new").length;
  const twoCol = width >= 760;
  const frameCols = width < 560 ? 3 : 6;

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View>
        <Eyebrow>Site content</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8 }}>Who the studio is, and the copy and featured frames on the public landing page.</Body>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 260 }}>
            <Eyebrow>Studio identity</Eyebrow>
            <Body muted size={13} style={{ marginTop: 6 }}>
              These names are the studio’s single source of truth. Luma addresses whoever is signed in by the Studio Manager name, and documents, reports, invoices and correspondence sign off with them. Employment terms for the same people live on Studio Staff.
            </Body>
          </View>
          <Button label="Save identity" onPress={() => {
            if (!identity.manager.name.trim()) { setIdentityFlash("A studio manager name is required — Luma addresses you by it"); return; }
            if (!identity.photographer.name.trim()) { setIdentityFlash("A lead photographer name is required"); return; }
            setIdentityFlash("Studio identity saved — Luma and every document now use these names");
          }} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(Object.keys(identity) as IdentityKey[]).map((key) => {
            const rec = identity[key];
            const missing = rec.required && !rec.name.trim();
            return (
              <Card key={key} style={{ padding: 18, gap: 12, flexGrow: 1, flexBasis: twoCol ? 320 : "100%" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.secondary }}>{rec.slot}</Text>
                  <Badge label={rec.required ? "Required" : "Optional"} tone={rec.required ? "gold" : "muted"} />
                </View>
                {IDENTITY_FIELDS.map(([field, label, placeholder]) => (
                  <View key={field} style={{ gap: 6 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text>
                    <TextInput
                      value={rec[field]} onChangeText={(t) => setIdentityField(key, field, t)}
                      placeholder={placeholder} placeholderTextColor={theme.ink.tertiary}
                      style={{ minHeight: 46, paddingHorizontal: 14, borderWidth: 1,
                        borderColor: field === "name" && missing ? theme.status.warning : theme.border.default,
                        borderRadius: radius.xs, backgroundColor: theme.surface.inset, color: theme.ink.primary, fontSize: 15 }}
                    />
                  </View>
                ))}
                {missing ? (
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, color: theme.status.warning }}>
                    Enter a name — until then Luma greets you generically and documents read “the studio manager”.
                  </Text>
                ) : null}
                <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 13, lineHeight: 19, color: theme.ink.tertiary }}>{rec.hint}</Text>
              </Card>
            );
          })}
        </View>

        <Card gold style={{ padding: 16, gap: 6 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>Luma will greet you</Text>
          <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontSize: 15, lineHeight: 24, color: theme.ink.primary }}>{adminGreeting(identity, newInquiries)}</Text>
        </Card>
        {identityFlash ? (
          <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary }}>{identityFlash}</Text>
        ) : null}
      </View>

      <View>
        <Eyebrow>Landing page copy</Eyebrow>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {BLOCKS.map(([key, title, , isArea]) => (
          <Card key={key} style={{ padding: 18, width: twoCol ? undefined : "100%", flexGrow: 1, flexBasis: twoCol ? 300 : "100%" }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, color: theme.ink.tertiary, marginBottom: 10 }}>{title}</Text>
            <TextInput value={values[key]} onChangeText={(t) => setValues((s) => ({ ...s, [key]: t }))} multiline={isArea}
              style={{ minHeight: isArea ? 84 : 46, paddingHorizontal: 14, paddingVertical: isArea ? 12 : 0, textAlignVertical: isArea ? "top" : "center",
                borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.inset, color: theme.ink.primary, fontSize: isArea ? 14 : 15 }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
              <Pressable onPress={() => setSaved(key)} style={{ minHeight: 40, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 10.5, color: saved === key ? theme.brand.gold : theme.ink.secondary }}>{saved === key ? "Saved" : "Save"}</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>

      <View>
        <Eyebrow>Featured frames · landing strip</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {PROOFS.slice(0, 6).map((p) => (
            <View key={p.id} style={{ flexGrow: 1, flexBasis: `${100 / frameCols - 2}%`, aspectRatio: 4 / 5, borderWidth: 1, borderColor: theme.border.default, overflow: "hidden" }}>
              <Image source={{ uri: proofUri(p.pid, 320) }} accessibilityLabel={p.label} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
