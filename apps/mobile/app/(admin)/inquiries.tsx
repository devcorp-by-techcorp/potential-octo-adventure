/**
 * Inquiries — tentative requests from the studio site, moved through the
 * enquiry state machine. Only the transitions the current state allows are
 * offered. Confirming needs a linked client and a date with no confirmed
 * booking, and is what creates the booking. Every change lands on the
 * request's audit trail.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateLabel, dateShort } from "~/data/seed";
import { INQ_FLOW, INQ_LABELS, INQ_MESSAGES, inqState, inqTone, transitionLabel, type InquiryState } from "~/data/enquiry";
import { KidsOverview } from "~/components/KidsOverview";
import { useStudio } from "~/state/studio";
import { useRecords } from "~/state/records";

export default function Inquiries() {
  const { theme, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const params = useLocalSearchParams<{ inquiry?: string }>();
  const linked = Array.isArray(params.inquiry) ? params.inquiry[0] : params.inquiry;
  const { inquiries: rows, newInquiryCount, clientFor, transitionInquiry, addContactFromInquiry } = useRecords();
  const { identity } = useStudio();
  const twoPanel = width >= 900;
  // The list is the entry point on a handset; with two panes the first inquiry is shown so the reader is never blank.
  const [openId, setOpenId] = React.useState<string | null>(linked ?? (twoPanel ? rows[0]?.id ?? null : null));
  const [notice, setNotice] = React.useState<{ id: string; text: string; error: boolean } | null>(null);
  React.useEffect(() => { if (linked) setOpenId(linked); }, [linked]);

  const open = rows.find((q) => q.id === openId) ?? null;
  const actor = identity.manager.name || "Studio";
  const bookedBy = identity.manager.name ? `${identity.manager.name} · ${identity.manager.title || "Studio Manager"}` : "Studio";

  const go = (id: string, to: InquiryState) => {
    const r = transitionInquiry(id, to, actor, bookedBy);
    if (!r.ok) return setNotice({ id, text: r.error, error: true });
    setNotice({ id, text: to === "confirmed" ? "Booking confirmed and added to Bookings." : `${INQ_LABELS[to]} — recorded on the request.`, error: false });
  };
  const addClient = (id: string) => {
    const r = addContactFromInquiry(id);
    setNotice({ id, text: r.ok ? "Added to Contacts and linked to this request." : r.error, error: !r.ok });
  };
  const label9 = { fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 1.5, fontSize: 9, color: theme.ink.tertiary };

  const list = (
    <View style={{ flex: twoPanel ? undefined : 1, width: twoPanel ? 340 : "100%" }}>
      <Eyebrow>{newInquiryCount} awaiting review of {rows.length}</Eyebrow>
      <Body muted size={13} style={{ marginTop: 8 }}>Tentative requests from the studio site. Nothing is booked or held until you confirm it.</Body>
      <View style={{ marginTop: 16, gap: 8 }}>
        {rows.map((q) => {
          const st = inqState(q);
          return (
            <Pressable key={q.id} onPress={() => { setOpenId(q.id); setNotice(null); }} accessibilityRole="button" accessibilityLabel={`${q.name}, ${INQ_LABELS[st]}`}>
              <Card style={{ padding: 16, borderColor: openId === q.id ? theme.border.gold : theme.border.subtle, flexDirection: "row", gap: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: st === "tentative_request" ? theme.brand.gold : theme.border.default }} />
                <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{q.name}</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary }}>{q.type} · {dateShort(q.date)}</Text>
                  <Badge label={INQ_LABELS[st]} tone={inqTone(st)} />
                </View>
              </Card>
            </Pressable>
          );
        })}
        {rows.length === 0 ? (
          <Card style={{ padding: 36, alignItems: "center" }}>
            <Display size={19}>No inquiries</Display>
            <Body muted size={12.5} style={{ marginTop: 6 }}>Requests from the studio site appear here.</Body>
          </Card>
        ) : null}
      </View>
    </View>
  );

  const reader = open ? (() => {
    const st = inqState(open);
    const next = INQ_FLOW[st] ?? [];
    const client = clientFor(open);
    const facts: [string, string][] = [["Preferred date", dateLabel(open.date)], ["Session", open.type], ["Email", open.email]];
    if (open.phone) facts.push(["Phone", open.phone]);
    if (open.venue) facts.push(["Venue", open.venue]);
    if (open.pkg) facts.push(["Collection", open.pkg]);
    return (
      <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
        {!twoPanel ? (
          <Pressable onPress={() => setOpenId(null)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: 2 }}>
            <Icon name="chevronL" size={16} color={theme.ink.secondary} />
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 11, color: theme.ink.secondary }}>All inquiries</Text>
          </Pressable>
        ) : null}
        <Card style={{ padding: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={label9}>Received {dateLabel(open.receivedAt)}{open.ref ? ` · ${open.ref}` : ""}</Text>
              <Display size={26} style={{ marginTop: 6 }}>{open.name}</Display>
              <Text selectable style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary, marginTop: 4 }}>{open.email}</Text>
            </View>
            <Badge label={INQ_LABELS[st]} tone={inqTone(st)} />
          </View>
          <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 18 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {facts.map(([k, v]) => (
              <View key={k} style={{ minWidth: 140, flexGrow: 1 }}>
                <Text style={label9}>{k}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.brand.gold, marginTop: 3 }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 18 }} />
          <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(17), lineHeight: fs(17) * 1.55, color: theme.ink.primary }}>{open.message}</Text>
          {open.source ? <Text style={[label9, { marginTop: 12 }]}>{open.source}</Text> : null}

          <View style={{ borderLeftWidth: 2, borderLeftColor: theme.border.gold, paddingLeft: 12, marginTop: 20 }}>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 14.5, color: theme.ink.secondary }}>Client sees: “{INQ_MESSAGES[st]}”</Text>
          </View>

          {/* Linked client — required before the studio can confirm. */}
          {st !== "confirmed" && st !== "abandoned" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 18 }}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={label9}>Linked client</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: client ? theme.ink.primary : theme.ink.tertiary, marginTop: 3 }}>
                  {client ? `${client.name} · in Contacts` : "Not in Contacts yet — needed before confirming"}
                </Text>
              </View>
              {!client ? <Button label="Add to Contacts" variant="ghost" icon="plus" onPress={() => addClient(open.id)} /> : null}
            </View>
          ) : null}

          {next.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
              {next.map((to) => (
                <Button key={to} label={transitionLabel(st, to)} variant={to === "confirmed" || to === "awaiting_studio_confirmation" ? "primary" : "ghost"} onPress={() => go(open.id, to)} />
              ))}
            </View>
          ) : null}
          {st === "confirmed" ? (
            <View style={{ marginTop: 18 }}>
              <Button label="Open Bookings" variant="ghost" icon="calendar" onPress={() => router.push("/(admin)/bookings")} />
            </View>
          ) : null}

          {notice && notice.id === open.id ? (
            <View accessibilityRole="alert" style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 2, borderWidth: 1, borderColor: notice.error ? theme.status.warning : theme.border.gold, backgroundColor: notice.error ? "rgba(212,163,86,0.12)" : theme.brand.goldMuted }}>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{notice.text}</Text>
            </View>
          ) : null}

          {open.audit?.length ? (
            <View style={{ gap: 5, borderTopWidth: 1, borderTopColor: theme.border.subtle, paddingTop: 12, marginTop: 18 }}>
              <Text style={label9}>Audit trail</Text>
              {open.audit.map((a, i) => (
                <Text key={i} style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, lineHeight: 16, color: theme.ink.tertiary }}>{a.at} · {a.actor} · {INQ_LABELS[a.from]} → {INQ_LABELS[a.to]}</Text>
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    );
  })() : null;

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
