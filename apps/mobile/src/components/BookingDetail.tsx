/**
 * BookingDetail — the derived booking view (deposit/balance/countdown, booked-by,
 * notes, actions). Rendered inline as a detail PANE on wide screens and inside a
 * bottom-sheet Modal on compact screens (see bookings.tsx).
 */
import React from "react";
import { View, Text } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { Eyebrow, Display, Body, Card, Badge, Button } from "~/components/ui";
import { Booking, money, daysUntil } from "~/data/seed";

export function BookingDetail({ b }: { b: Booking }) {
  const { theme, space } = useTokens();
  const deposit = Math.round(b.value * 0.3);
  const paid = b.phase >= 3 ? deposit : 0;
  const balance = b.value - paid;

  const Row = ({ k, v }: { k: string; v: string }) => (
    <View style={{ flexGrow: 1, flexBasis: 110 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9, color: theme.ink.tertiary }}>{k}</Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.primary, marginTop: 2 }}>{v}</Text>
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Eyebrow>Booking detail</Eyebrow>
        <Display size={28} style={{ marginTop: 4 }}>{b.clientName}</Display>
        <Body muted size={12.5} style={{ marginTop: 2 }}>{b.eventType} · {b.time}</Body>
        <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary, marginTop: 4 }}>{b.venue} · VIC</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Card style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9, color: theme.ink.tertiary }}>Countdown</Text>
          <Display size={26} style={{ marginTop: 2 }}>{daysUntil(b.date)} days</Display>
        </Card>
        <Card style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9, color: theme.ink.tertiary }}>Package</Text>
          <Display size={26} style={{ marginTop: 2 }}>{b.pkg}</Display>
        </Card>
      </View>

      <Card style={{ padding: 16 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary, marginBottom: 10 }}>Payment</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Row k="Total" v={money(b.value)} />
          <Row k="Retainer paid" v={money(paid)} />
          <Row k="Balance due" v={money(balance)} />
        </View>
      </Card>

      <Card style={{ padding: 16 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary }}>Booked by</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.primary, marginTop: 4 }}>{b.bookedBy}</Text>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary, marginTop: 14 }}>Notes</Text>
        <Body muted size={13} style={{ marginTop: 4 }}>{b.notes}</Body>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Documents" icon="doc" variant="ghost" />
        <Button label="Brief" icon="sparkle" variant="ghost" />
        <Button label="Confirm" icon="check" />
      </View>
    </View>
  );
}
