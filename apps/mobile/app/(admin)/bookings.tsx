/**
 * Admin bookings — master / detail. This is a DISTINCT tablet layout, not a
 * stretched phone: on wide screens the list and the detail sit in two panes;
 * on compact screens tapping a row opens the detail in a bottom-sheet Modal.
 * The switch is driven by measured width and flips live on rotation / resize.
 */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Body, Card, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { BookingDetail } from "~/components/BookingDetail";
import { BOOKINGS, Booking, money$, dateLabel } from "~/data/seed";
import { KidsOverview } from "~/components/KidsOverview";

export default function Bookings() {
  const { theme, space } = useTokens();
  const { fs, gutter, isWide } = useResponsive();
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(isWide ? BOOKINGS[0].id : null);
  const active = BOOKINGS.find((b) => b.id === activeId) || null;

  const List = (
    <View style={{ flex: isWide ? 1 : undefined }}>
      <Eyebrow>All bookings</Eyebrow>
      <View style={{ marginTop: 12, gap: 10 }}>
        {BOOKINGS.map((b) => {
          const on = isWide && activeId === b.id;
          return (
            <Pressable key={b.id} onPress={() => setActiveId(b.id)}>
              <Card gold={on} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary }}>{b.clientName}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11.5, color: theme.ink.tertiary, marginTop: 3 }}>{b.eventType} · {dateLabel(b.date)}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, color: theme.ink.tertiary, marginTop: 3 }}>{b.venue}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Badge label={b.status} tone={b.status === "confirmed" ? "success" : "warning"} />
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 16, color: theme.ink.primary, marginTop: 6 }}>{money$(b.value)}</Text>
                  <View style={{ marginTop: 24 }}><KidsOverview kind="bookings" /></View>
    </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (isWide) {
    return (
      <ScrollView contentContainerStyle={{ padding: gutter }}>
        <View style={{ flexDirection: "row", gap: space.s5, alignItems: "flex-start" }}>
          {List}
          {active ? <View style={{ flex: 1.1 }}><BookingDetail b={active} /></View> : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: gutter }}>{List}</ScrollView>
      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActiveId(null)}>
        <Pressable onPress={() => setActiveId(null)} style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ maxHeight: "92%", backgroundColor: theme.surface.raised, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: insets.bottom }}>
            <View style={{ alignItems: "center", paddingVertical: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border.default }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: gutter, paddingTop: 0 }}>
              {active ? <BookingDetail b={active} /> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
