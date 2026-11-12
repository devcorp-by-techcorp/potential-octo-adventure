/**
 * Illuminate Kids summaries for the MAIN studio surfaces (Dashboard, Bookings,
 * Inquiries, Shoot Tracker). The studio manager's view is company-wide, so
 * these carry operational Kids data across — but never a child's details and
 * never Kids finance. The reverse does not apply: the Kids workspace shows no
 * Illuminate Studios data.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Card } from "~/components/ui";
import { useKids } from "~/state/kids";
import { dayOf, monShort } from "~/data/seed";
import { KIDS_PHASES, inqState, orgStats, dateLong } from "~/data/kids";

type Kind = "dashboard" | "bookings" | "inquiries" | "tracker";
const TITLES: Record<Kind, string> = { dashboard: "Illuminate Kids", bookings: "Illuminate Kids bookings", inquiries: "Illuminate Kids inquiries", tracker: "Illuminate Kids shoots" };
const SEG: Record<Kind, string> = { dashboard: "dash", bookings: "bookings", inquiries: "inquiries", tracker: "tracker" };

export function KidsOverview({ kind }: { kind: Kind }) {
  const { theme } = useTokens();
  const { fs, width } = useResponsive();
  const router = useRouter();
  const { db, bookings, inquiries } = useKids();
  const go = (params: Record<string, string>) => router.push({ pathname: "/(admin)/illuminate-kids", params });

  const tentative = inquiries.filter((q) => inqState(q) === "tentative_request");
  const upcoming = [...bookings].sort((a, b) => a.iso.localeCompare(b.iso));
  const totals = db.orgs.reduce((a, o) => { const s = orgStats(db, o.id); return { reg: a.reg + s.registered, total: a.total + s.total }; }, { reg: 0, total: 0 });
  const next = upcoming[0];
  const orgName = (id: string) => db.orgs.find((o) => o.id === id)?.name ?? "";
  const label9 = (color: string) => ({ fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 1.5, fontSize: 9, color });
  const italic = { fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic" as const, fontSize: 13, color: theme.ink.tertiary };

  const Row = ({ title, meta, onPress, first }: { title: string; meta: string; onPress: () => void; first: boolean }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`}
      style={{ minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, justifyContent: "center", borderTopWidth: first ? 0 : 1, borderTopColor: theme.border.subtle }}>
      <Text numberOfLines={1} style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{title}</Text>
      <Text numberOfLines={2} style={[italic, { marginTop: 2 }]}>{meta}</Text>
    </Pressable>
  );

  let body: React.ReactNode;
  if (kind === "dashboard") {
    const kpis = [
      { label: "Kids bookings", value: String(bookings.length), hint: "Illuminate Kids" },
      { label: "Kids inquiries", value: String(tentative.length), hint: "awaiting response", accent: tentative.length > 0 },
      { label: "Children registered", value: String(totals.reg), hint: `of ${totals.total} on rosters` },
      { label: "Next Kids shoot", value: next ? `${dayOf(next.iso)} ${monShort(next.iso)}` : "—", hint: next ? orgName(next.orgId) : "none booked" },
    ];
    body = (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {kpis.map((k) => (
          <Pressable key={k.label} onPress={() => go({ seg: "dash" })} accessibilityRole="button" accessibilityLabel={`${k.label}: ${k.value}, ${k.hint}`} style={{ flexGrow: 1, flexBasis: width >= 420 ? 150 : "100%" }}>
            <Card gold={k.accent} style={{ padding: fs(18) }}>
              <Text style={label9(k.accent ? theme.brand.gold : theme.ink.tertiary)}>{k.label}</Text>
              <Display size={32} style={{ marginTop: 10, color: k.accent ? theme.brand.gold : theme.ink.primary }}>{k.value}</Display>
              <Text numberOfLines={1} style={[italic, { marginTop: 4 }]}>{k.hint}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    );
  } else if (kind === "bookings") {
    body = (
      <Card style={{ overflow: "hidden" }}>
        {upcoming.map((b, i) => (
          <Row key={b.id} first={i === 0} title={orgName(b.orgId)} meta={`${db.shoots[b.orgId]?.label ?? ""} · ${dateLong(b.iso)} · ${b.status}`} onPress={() => go({ seg: "orgs", org: b.orgId })} />
        ))}
      </Card>
    );
  } else if (kind === "inquiries") {
    body = (
      <Card style={{ overflow: "hidden" }}>
        {tentative.length
          ? tentative.map((q, i) => <Row key={q.id} first={i === 0} title={q.org} meta={`${q.type} · received ${dateLong(q.received)}`} onPress={() => go({ seg: "inquiries", inq: q.id })} />)
          : <Text style={[italic, { fontSize: 14, padding: 14 }]}>No Kids requests awaiting review.</Text>}
      </Card>
    );
  } else {
    body = (
      <Card style={{ overflow: "hidden" }}>
        {db.orgs.map((o, i) => {
          const sh = db.shoots[o.id];
          return <Row key={o.id} first={i === 0} title={o.name} meta={`${sh?.label ?? ""} · ${sh?.date ?? ""} · ${KIDS_PHASES[sh?.phase ?? 0]}`} onPress={() => go({ seg: "tracker" })} />;
        })}
      </Card>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Eyebrow>{TITLES[kind]}</Eyebrow>
        <Pressable onPress={() => go({ seg: SEG[kind] })} accessibilityRole="link" accessibilityLabel="Open the Illuminate Kids workspace" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={label9(theme.brand.gold)}>Open Kids →</Text>
        </Pressable>
      </View>
      {body}
    </View>
  );
}
