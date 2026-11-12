/**
 * Documents Centre — the studio's reusable template library, and the documents
 * produced from it and filed to a client profile.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Body, Card, Badge } from "~/components/ui";
import { Icon, IconName } from "~/components/Icon";
import { TEMPLATES, STUDIO_DOCS, dateLabel } from "~/data/seed";
import { useRecords } from "~/state/records";

function Seg({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  const { theme } = useTokens();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderBottomWidth: 2, borderColor: on ? theme.brand.gold : "transparent" }}>
      <Icon name={icon} size={16} color={on ? theme.brand.gold : theme.ink.tertiary} />
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 10.5, color: on ? theme.brand.gold : theme.ink.tertiary }}>{label}</Text>
    </Pressable>
  );
}

export default function Documents() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter } = useResponsive();
  const [seg, setSeg] = React.useState<"library" | "filed">("library");
  const [q, setQ] = React.useState("");
  const [group, setGroup] = React.useState("all");
  const groups = ["all", ...TEMPLATES.map((t) => t[3]).filter((g, i, a) => a.indexOf(g) === i)];
  const needle = q.trim().toLowerCase();
  const rows = TEMPLATES.filter(([, name, type, g]) =>
    (group === "all" || g === group) && (!needle || name.toLowerCase().includes(needle) || type.toLowerCase().includes(needle)));
  const { contacts: CONTACTS } = useRecords();
  const clientName = (id: string) => CONTACTS.find((c) => c.id === id)?.name ?? "—";

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s4 }}>
      <View>
        <Eyebrow>Documents centre</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8 }}>The studio's reusable templates, and the documents produced from them and filed to a client profile.</Body>
      </View>

      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: theme.border.subtle }}>
        <Seg label="Library" icon="folder" on={seg === "library"} onPress={() => setSeg("library")} />
        <Seg label="Filed" icon="doc" on={seg === "filed"} onPress={() => setSeg("filed")} />
      </View>

      {seg === "library" ? (
        <View style={{ gap: 14 }}>
          <View style={{ maxWidth: 460 }}>
            <View style={{ position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}>
              <Icon name="search" size={16} color={theme.ink.tertiary} />
            </View>
            <TextInput value={q} onChangeText={setQ} placeholder="Search templates…" placeholderTextColor={theme.ink.tertiary}
              style={{ minHeight: 46, paddingLeft: 40, paddingRight: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {groups.map((g) => {
              const on = group === g;
              return (
                <Pressable key={g} onPress={() => setGroup(g)} style={{ minHeight: 38, paddingHorizontal: 14, justifyContent: "center", borderRadius: 9999, borderWidth: 1, borderColor: on ? theme.brand.gold : theme.border.default, backgroundColor: on ? theme.brand.gold : theme.surface.raised }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: on ? theme.ink.inverse : theme.ink.secondary }}>{g === "all" ? "All groups" : g}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{rows.length} of {TEMPLATES.length} templates</Text>
          <View style={{ gap: 8 }}>
            {rows.map(([num, name, type, g]) => (
              <Card key={num} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.brand.gold }}>{num}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{name}</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 12.5, color: theme.ink.tertiary }}>{g}</Text>
                </View>
                <Badge label={type} tone="muted" />
              </Card>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{STUDIO_DOCS.length} filed documents</Text>
          {STUDIO_DOCS.map((d) => (
            <Card key={d.id} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Icon name="doc" size={20} color={theme.brand.gold} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{d.title}</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 13, color: theme.ink.secondary }}>{clientName(d.contactId)}</Text>
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, color: theme.ink.tertiary }}>{d.type} · filed {dateLabel(d.createdAt)}</Text>
              </View>
              <Badge label={d.status} tone={d.status === "signed" ? "success" : d.status === "awaiting signature" ? "warning" : "muted"} />
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
