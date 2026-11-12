/**
 * Contacts — the studio's contact book. Assigned contacts hold a live portal
 * account; the badge toggles that assignment.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateShort, initials } from "~/data/seed";
import { useRecords } from "~/state/records";

export default function Contacts() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const { contacts: CONTACTS, bookings: BOOKINGS } = useRecords();
  const [assigned, setAssigned] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(CONTACTS.map((c) => [c.id, c.assigned])));
  const [q, setQ] = React.useState("");
  const cols = width >= 1040 ? 3 : width >= 680 ? 2 : 1;
  const needle = q.trim().toLowerCase();
  const rows = CONTACTS.filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle));

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View>
        <Eyebrow>Contact book</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8 }}>Past, present and prospective clients. Assigned contacts have a live portal account.</Body>
      </View>

      <View style={{ maxWidth: 460 }}>
        <View style={{ position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}>
          <Icon name="search" size={16} color={theme.ink.tertiary} />
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search contacts…" placeholderTextColor={theme.ink.tertiary}
          style={{ minHeight: 46, paddingLeft: 40, paddingRight: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {rows.map((c) => {
          const b = BOOKINGS.find((x) => x.id === c.bookingId);
          const on = assigned[c.id];
          return (
            <Card key={c.id} style={{ padding: 18, width: cols === 1 ? "100%" : undefined, flexGrow: 1, flexBasis: cols === 1 ? "100%" : 240 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border.default, backgroundColor: theme.surface.inset, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 13, color: theme.brand.gold }}>{initials(c.name)}</Text>
                </View>
                <Pressable onPress={() => setAssigned((s) => ({ ...s, [c.id]: !s[c.id] }))} accessibilityRole="switch" accessibilityState={{ checked: on }}>
                  <Badge label={on ? "Portal active" : "No portal"} tone={on ? "success" : "muted"} />
                </Pressable>
              </View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary }}>{c.name}</Text>
              <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 14, color: theme.ink.secondary, marginTop: 4 }}>{c.email}</Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary, marginTop: 2 }}>{c.phone}</Text>
              {b ? (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: theme.border.subtle }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, color: theme.ink.tertiary }}>Active booking</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: theme.brand.gold, marginTop: 4 }}>{b.eventType} · {dateShort(b.date)}</Text>
                </View>
              ) : null}
              {c.tags.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {c.tags.map((t) => <Badge key={t} label={t} tone="gold" />)}
                </View>
              ) : null}
            </Card>
          );
        })}
        {rows.length === 0 ? (
          <Card style={{ padding: 36, alignItems: "center", width: "100%" }}>
            <Display size={19}>No matching contacts</Display>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
