/**
 * Studio dashboard — KPI strip, upcoming shoots, recent activity and the
 * in-progress phase lane. Inquiries live on their own surface, so nothing is
 * duplicated here. Figures derive from the booking records.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge } from "~/components/ui";
import { BOOKINGS, INQUIRIES_FULL, CONTACTS, ACTIVITY, PHASES, dayOf, monShort, STUDIO_TODAY } from "~/data/seed";

export default function Dashboard() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const kpiCols = width >= 760 ? 4 : width >= 420 ? 2 : 1;
  const twoPanel = width >= 860;
  const today = new Date(STUDIO_TODAY);
  const confirmed = BOOKINGS.filter((b) => b.status === "confirmed");
  const newInquiries = INQUIRIES_FULL.filter((q) => q.status === "new").length;
  const upcoming = BOOKINGS.filter((b) => new Date(b.date) > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const inProgress = BOOKINGS.filter((b) => b.phase >= 2 && b.phase < 7);
  const kpis = [
    { label: "Active bookings", value: String(confirmed.length), hint: "this season" },
    { label: "New inquiries", value: String(newInquiries), hint: "awaiting response", accent: true },
    { label: "Season revenue", value: (confirmed.reduce((s, b) => s + b.value, 0) / 1000).toFixed(1) + "k", hint: "AUD · confirmed" },
    { label: "Contacts", value: String(CONTACTS.length), hint: "in the book" },
  ];
  const daysTo = (iso: string) => {
    const n = Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000);
    return n <= 0 ? "Today" : "In " + n + " days";
  };

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {kpis.map((k) => (
          <Card key={k.label} gold={k.accent} style={{ width: kpiCols === 1 ? "100%" : undefined, flexGrow: 1, flexBasis: kpiCols === 1 ? "100%" : 150, padding: fs(18) }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: k.accent ? theme.brand.gold : theme.ink.tertiary }}>{k.label}</Text>
            <Display size={40} style={{ marginTop: 10, color: k.accent ? theme.brand.gold : theme.ink.primary }}>{k.value}</Display>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, marginTop: 4, color: theme.ink.tertiary }}>{k.hint}</Text>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: twoPanel ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
        <View style={{ flex: twoPanel ? 1 : undefined, width: twoPanel ? undefined : "100%" }}>
          <Eyebrow>Upcoming shoots</Eyebrow>
          <Card style={{ marginTop: 12, overflow: "hidden" }}>
            {upcoming.map((b, i) => (
              <Pressable key={b.id} onPress={() => router.replace("/(admin)/bookings")} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderColor: theme.border.subtle }}>
                <View style={{ width: 46, alignItems: "center", borderRightWidth: 1, borderColor: theme.border.subtle, paddingRight: 12 }}>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 22, color: theme.brand.gold }}>{dayOf(b.date)}</Text>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1, color: theme.ink.tertiary }}>{monShort(b.date)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{b.clientName}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{b.eventType} · {b.venue}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Badge label={b.status} tone={b.status === "confirmed" ? "success" : "warning"} />
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary }}>{daysTo(b.date)}</Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>

        <View style={{ flex: twoPanel ? 1 : undefined, width: twoPanel ? undefined : "100%" }}>
          <Eyebrow>Recent activity</Eyebrow>
          <Card style={{ marginTop: 12, padding: 18 }}>
            {ACTIVITY.map((a, i) => (
              <View key={a.text} style={{ flexDirection: "row", gap: 14, paddingVertical: 11, borderBottomWidth: i === ACTIVITY.length - 1 ? 0 : 1, borderColor: theme.border.subtle }}>
                <Text style={{ width: 44, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, paddingTop: 3, color: a.gold ? theme.brand.gold : theme.ink.tertiary }}>{a.time} ago</Text>
                <Text style={{ flex: 1, fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15.5, lineHeight: 22, color: a.gold ? theme.brand.goldHover : theme.ink.secondary }}>{a.text}</Text>
              </View>
            ))}
          </Card>
        </View>
      </View>

      <View>
        <Eyebrow>In progress · {inProgress.length} active projects</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", gap: 1, backgroundColor: theme.border.subtle }}>
            {PHASES.slice(1, -1).map((p, i) => {
              const at = BOOKINGS.filter((b) => b.phase === i + 1);
              return (
                <View key={p.label} style={{ width: 150, minHeight: 150, padding: 14, backgroundColor: theme.surface.raised }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, lineHeight: 13, minHeight: 26, color: theme.brand.gold }}>{p.label}</Text>
                  <Display size={26} style={{ marginTop: 10, marginBottom: 12, color: theme.brand.gold }}>{String(at.length)}</Display>
                  <View style={{ gap: 6 }}>
                    {at.slice(0, 3).map((b) => (
                      <Text key={b.id} numberOfLines={1} style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 12.5, color: theme.ink.secondary, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: theme.surface.inset, borderWidth: 1, borderColor: theme.border.subtle }}>{b.clientName.split(" · ")[0]}</Text>
                    ))}
                    {at.length > 3 ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: theme.ink.tertiary }}>+ {at.length - 3} more</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}
