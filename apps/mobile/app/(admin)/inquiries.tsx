/**
 * Inquiries — triage from the landing page. Accepting one creates a pending
 * booking; the list narrows to a reader on compact widths.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { Inquiry, dateLabel, dateShort } from "~/data/seed";
import { useRouter } from "expo-router";
import { useStudio } from "~/state/studio";
import { useRecords } from "~/state/records";
import { KidsOverview } from "~/components/KidsOverview";


export default function Inquiries() {
  const { theme, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const { inquiries, acceptInquiry, declineInquiry } = useRecords();
  const { identity } = useStudio();
  // Accepted inquiries have become bookings, so they leave this list.
  const rows = inquiries.filter((q) => q.status !== "accepted");
  const twoPanel = width >= 900;
  // The list is the entry point on a handset; with two panes the first inquiry is shown so the reader is never blank.
  const [openId, setOpenId] = React.useState<string | null>(twoPanel ? rows[0]?.id ?? null : null);
  const open = rows.find((q) => q.id === openId) ?? null;
  const newCount = rows.filter((q) => q.status === "new").length;

  // Commits the booking (and the contact, if new) to shared records, then opens it.
  const accept = (q: Inquiry) => {
    const who = identity.manager.name ? `${identity.manager.name} · ${identity.manager.title || "Studio Manager"}` : "Studio";
    const bookingId = acceptInquiry(q.id, who);
    setOpenId(null);
    if (bookingId) router.push({ pathname: "/(admin)/bookings", params: { booking: bookingId } });
  };
  const decline = (q: Inquiry) => declineInquiry(q.id);

  const list = (
    <View style={{ flex: twoPanel ? undefined : 1, width: twoPanel ? 340 : "100%" }}>
      <Eyebrow>{newCount} new of {rows.length}</Eyebrow>
      <Body muted size={13} style={{ marginTop: 8 }}>Booking requests from the landing page. Accept to create a booking and send the agreement.</Body>
      <View style={{ marginTop: 16, gap: 8 }}>
        {rows.map((q) => (
          <Pressable key={q.id} onPress={() => setOpenId(q.id)}>
            <Card style={{ padding: 16, borderColor: openId === q.id ? theme.border.gold : theme.border.subtle, flexDirection: "row", gap: 12 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: q.status === "new" ? theme.brand.gold : theme.border.default }} />
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{q.name}</Text>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary }}>{q.type} · {dateShort(q.date)}</Text>
                <Body muted size={12} numberOfLines={2}>{q.message}</Body>
              </View>
            </Card>
          </Pressable>
        ))}
        {rows.length === 0 ? (
          <Card style={{ padding: 36, alignItems: "center" }}>
            <Display size={19}>No open inquiries</Display>
            <Body muted size={12.5} style={{ marginTop: 6 }}>Every request has been triaged.</Body>
          </Card>
        ) : null}
      </View>
    </View>
  );

  const reader = open ? (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      {!twoPanel ? (
        <Pressable onPress={() => setOpenId(null)} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: 3 }}>
          <Icon name="chevronL" size={16} color={theme.ink.secondary} />
          <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 11, color: theme.ink.secondary }}>All inquiries</Text>
        </Pressable>
      ) : null}
      <Card style={{ padding: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9, color: theme.ink.tertiary }}>Received {dateLabel(open.receivedAt)}</Text>
            <Display size={26} style={{ marginTop: 6 }}>{open.name}</Display>
            <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary, marginTop: 4 }}>{open.email}</Text>
          </View>
          <Badge label={open.status} tone={open.status === "new" ? "gold" : open.status === "declined" ? "muted" : "warning"} />
        </View>
        <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 18 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {[["Date", dateLabel(open.date)], ["Event", open.type], ["Email", open.email]].map(([k, v]) => (
            <View key={k} style={{ minWidth: 140, flexGrow: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary }}>{k}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.brand.gold, marginTop: 3 }}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 18 }} />
        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(17), lineHeight: fs(17) * 1.55, color: theme.ink.primary }}>{open.message}</Text>
        {open.status === "new" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
            <Button label="Decline" variant="ghost" onPress={() => decline(open)} />
            <Button label="Accept & create booking" icon="check" onPress={() => accept(open)} />
          </View>
        ) : null}
      </Card>
    </View>
  ) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View style={{ flexDirection: twoPanel ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
        {twoPanel || !open ? list : null}
        {reader}
      </View>
      {twoPanel || !open ? <KidsOverview kind="inquiries" /> : null}
    </ScrollView>
  );
}
