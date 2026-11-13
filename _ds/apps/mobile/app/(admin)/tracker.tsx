/**
 * Shoot Tracker — the studio's phase ladder. Setting a phase here is what the
 * client's portal reads on their next visit.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { BOOKINGS, PHASES, dateLabel } from "~/data/seed";

export default function Tracker() {
  const { theme, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const [phases, setPhases] = React.useState<Record<string, number>>(
    () => Object.fromEntries(BOOKINGS.map((b) => [b.id, b.phase])));
  const [focusId, setFocusId] = React.useState(BOOKINGS[0].id);
  const showAside = width >= 1040;
  const focus = BOOKINGS.find((b) => b.id === focusId) ?? BOOKINGS[0];
  const focusPhase = phases[focus.id];
  const set = (id: string, p: number) => setPhases((s) => ({ ...s, [id]: p }));

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View style={{ flexDirection: showAside ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0, width: showAside ? undefined : "100%" }}>
          <Eyebrow>Client pipeline</Eyebrow>
          <Body muted size={13} style={{ marginTop: 8 }}>Set each client's phase. The change is what their portal reads on the next visit.</Body>
          <View style={{ marginTop: 16, gap: 12 }}>
            {BOOKINGS.map((b) => {
              const ph = phases[b.id];
              return (
                <Pressable key={b.id} onPress={() => setFocusId(b.id)}>
                  <Card style={{ padding: 20, borderColor: focusId === b.id ? theme.border.gold : theme.border.subtle }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary }}>{b.clientName}</Text>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary, marginTop: 2 }}>{b.eventType} · {dateLabel(b.date)}</Text>
                      </View>
                      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9.5, color: theme.brand.gold, maxWidth: "40%", textAlign: "right" }}>{PHASES[ph].label}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {PHASES.map((p, i) => (
                        <Pressable key={p.label} onPress={() => set(b.id, i)} accessibilityLabel={p.label}
                          style={{ flex: 1, minWidth: 0, height: 40, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 2,
                            backgroundColor: i <= ph ? theme.brand.goldMuted : theme.surface.inset,
                            borderWidth: 1, borderColor: i === ph ? theme.brand.gold : i < ph ? theme.border.gold : theme.border.default }}>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: i <= ph ? theme.brand.gold : theme.border.default }} />
                          <Text numberOfLines={1} style={{ fontFamily: "Inter_500Medium", fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", color: i <= ph ? theme.brand.gold : theme.ink.tertiary }}>{p.label.split(" ")[0]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showAside ? (
          <View style={{ width: 340 }}>
            <Card style={{ padding: 22 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, color: theme.ink.tertiary }}>{focus.eventType}</Text>
              <Display size={22} style={{ marginTop: 6 }}>{focus.clientName}</Display>
              <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13.5, color: theme.ink.tertiary, marginTop: 4 }}>{dateLabel(focus.date)} · {focus.venue}</Text>
              <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 18 }} />
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, color: theme.ink.tertiary, marginBottom: 10 }}>Phase history</Text>
              <View style={{ gap: 1 }}>
                {PHASES.map((p, i) => (
                  <Pressable key={p.label} onPress={() => set(focus.id, i)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12,
                      borderLeftWidth: 2, borderLeftColor: i === focusPhase ? theme.brand.gold : "transparent",
                      backgroundColor: i === focusPhase ? theme.brand.goldMuted : theme.surface.inset }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1,
                      borderColor: i <= focusPhase ? theme.brand.gold : theme.border.default,
                      backgroundColor: i <= focusPhase ? theme.brand.gold : "transparent" }}>
                      {i < focusPhase ? <Icon name="check" size={9} stroke={3} color={theme.ink.inverse} /> : null}
                    </View>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11.5, letterSpacing: 0.8, textTransform: "uppercase", color: i <= focusPhase ? theme.brand.goldHover : theme.ink.tertiary }}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
