/**
 * Illuminate Kids — the studio's separate operational interface for the Kids
 * branch (governance). Dashboard · Bookings · Shoot Tracker · Inquiries ·
 * Organisations · Finance.
 *
 * Nothing here shows Illuminate Studios data, and Kids finance never appears in
 * the studio Finance view. A child's name and unique number appear only after
 * their guardian completes registration; before that the studio sees a count.
 *
 * Follows the studio design system like every other admin surface — the playful
 * Kids look belongs to the customer-facing Kids pages only.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Card, Badge, Button } from "~/components/ui";
import { useKids } from "~/state/kids";
import { useStudio } from "~/state/studio";
import { dayOf, monShort } from "~/data/seed";
import {
  KIDS_PHASES, INQ_LABELS, INQ_FLOW, INQ_MESSAGES, inqState, transitionLabel, orgStats, siblingsOf, fullName,
  aud, dateLong, type InquiryState,
} from "~/data/kids";

type Seg = "dash" | "bookings" | "tracker" | "inquiries" | "orgs" | "finance";
const SEGS: [Seg, string][] = [["dash", "Dashboard"], ["bookings", "Bookings"], ["tracker", "Shoot Tracker"], ["inquiries", "Inquiries"], ["orgs", "Organisations"], ["finance", "Finance"]];
const isSeg = (v: unknown): v is Seg => typeof v === "string" && SEGS.some(([k]) => k === v);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function AdminKids() {
  const { theme, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const params = useLocalSearchParams<{ seg?: string; org?: string; inq?: string }>();
  const { db, inquiries, bookings, invoices, expenses, setPhase, transition, markPaid } = useKids();
  const { identity } = useStudio();

  const [seg, setSeg] = React.useState<Seg>(isSeg(one(params.seg)) ? (one(params.seg) as Seg) : "dash");
  const [orgId, setOrgId] = React.useState<string>(one(params.org) ?? db.orgs[0].id);
  const [inqId, setInqId] = React.useState<string | null>(one(params.inq) ?? null);
  const [finSeg, setFinSeg] = React.useState<"invoices" | "expenses">("invoices");

  // Deep links from the main dashboard, bookings, inquiries and tracker.
  const pSeg = one(params.seg), pOrg = one(params.org), pInq = one(params.inq);
  React.useEffect(() => { if (isSeg(pSeg)) setSeg(pSeg); }, [pSeg]);
  React.useEffect(() => { if (pOrg) setOrgId(pOrg); }, [pOrg]);
  React.useEffect(() => { if (pInq) setInqId(pInq); }, [pInq]);

  const twoPane = width >= 900;
  const kpiBasis = width >= 760 ? 150 : width >= 420 ? 150 : "100%";
  const orgById = (id: string) => db.orgs.find((o) => o.id === id);
  const tentative = inquiries.filter((q) => inqState(q) === "tentative_request");
  const totals = db.orgs.reduce((a, o) => { const s = orgStats(db, o.id); return { reg: a.reg + s.registered, total: a.total + s.total }; }, { reg: 0, total: 0 });
  const upcoming = [...bookings].sort((a, b) => a.iso.localeCompare(b.iso));
  const selOrg = orgById(orgId) ?? db.orgs[0];
  const selInq = inquiries.find((q) => q.id === inqId) ?? null;
  const actor = identity.manager.name || "Studio";

  const label9 = (color: string = theme.ink.tertiary) => ({ fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 1.5, fontSize: 9, color });
  const italic = (size = 13) => ({ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic" as const, fontSize: size, color: theme.ink.tertiary });
  const rowTitle = { fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary };

  const Kpis = ({ items }: { items: { label: string; value: string; hint: string; accent?: boolean }[] }) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {items.map((k) => (
        <Card key={k.label} gold={k.accent} style={{ flexGrow: 1, flexBasis: kpiBasis, padding: fs(18) }}>
          <Text style={label9(k.accent ? theme.brand.gold : theme.ink.tertiary)}>{k.label}</Text>
          <Display size={38} style={{ marginTop: 10, color: k.accent ? theme.brand.gold : theme.ink.primary }}>{k.value}</Display>
          <Text style={[italic(), { marginTop: 4 }]}>{k.hint}</Text>
        </Card>
      ))}
    </View>
  );

  const SegStrip = <T extends string>({ items, value, onPick }: { items: [T, string][]; value: T; onPick: (v: T) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: theme.border.subtle, flexGrow: 0 }} contentContainerStyle={{ gap: 4 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onPick(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on}
            style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: on ? theme.brand.gold : "transparent" }}>
            <Text style={{ fontFamily: on ? "Inter_600SemiBold" : "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(10.5), color: on ? theme.brand.gold : theme.ink.tertiary }}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const statusTone = (s: string) => (s === "Confirmed" || s === "Paid" ? "success" : s === "Overdue" ? "warning" : "muted") as "success" | "warning" | "muted";
  const inqTone = (s: InquiryState) => (s === "confirmed" ? "success" : s === "tentative_request" ? "gold" : s === "abandoned" ? "muted" : "warning") as "success" | "gold" | "muted" | "warning";
  const openOrg = (id: string) => { setOrgId(id); setSeg("orgs"); };

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View>
        <Eyebrow>Illuminate Kids</Eyebrow>
        <Text style={[italic(fs(16)), { color: theme.ink.secondary, marginTop: 8, lineHeight: fs(16) * 1.5, maxWidth: 620 }]}>
          Schools, centres and clubs. Everything here is Illuminate Kids only, kept apart from studio work for governance. A child's name appears only after their guardian completes registration.
        </Text>
      </View>

      <SegStrip items={SEGS.map(([k, l]) => [k, k === "inquiries" && tentative.length ? `${l} · ${tentative.length}` : l] as [Seg, string])} value={seg} onPick={setSeg} />

      {seg === "dash" ? (
        <>
          <Kpis items={[
            { label: "Kids bookings", value: String(bookings.length), hint: "organisations booked" },
            { label: "Tentative requests", value: String(tentative.length), hint: "awaiting studio review", accent: true },
            { label: "Children registered", value: String(totals.reg), hint: `of ${totals.total} on rosters` },
            { label: "Organisations", value: String(db.orgs.length), hint: "linked by code" },
          ]} />
          <View style={{ flexDirection: twoPane ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
            <View style={{ flex: twoPane ? 1.4 : undefined, alignSelf: "stretch", minWidth: 0 }}>
              <Eyebrow>Upcoming Kids shoots</Eyebrow>
              <Card style={{ marginTop: 12, overflow: "hidden" }}>
                {upcoming.map((b, i) => {
                  const o = orgById(b.orgId); const sh = db.shoots[b.orgId]; const st = orgStats(db, b.orgId);
                  return (
                    <Pressable key={b.id} onPress={() => openOrg(b.orgId)} accessibilityRole="button" accessibilityLabel={`${o?.name}, ${dateLong(b.iso)}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: theme.border.subtle }}>
                      <View style={{ width: 46, alignItems: "center", borderRightWidth: 1, borderRightColor: theme.border.subtle, paddingRight: 12 }}>
                        <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 22, lineHeight: 24, color: theme.brand.gold }}>{dayOf(b.iso)}</Text>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 9, letterSpacing: 0.9, textTransform: "uppercase", color: theme.ink.tertiary }}>{monShort(b.iso)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={rowTitle}>{o?.name}</Text>
                        <Text numberOfLines={2} style={[italic(), { marginTop: 2 }]}>{sh?.label} · {st.registered} of {st.total} registered</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <Badge label={b.status} tone={statusTone(b.status)} />
                        <Text style={label9()}>{KIDS_PHASES[sh?.phase ?? 0]}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            </View>
            <View style={{ flex: twoPane ? 1 : undefined, alignSelf: "stretch", minWidth: 0 }}>
              <Eyebrow>Registration progress</Eyebrow>
              <Card style={{ marginTop: 12, padding: 16, gap: 14 }}>
                {db.orgs.map((o) => {
                  const st = orgStats(db, o.id);
                  return (
                    <View key={o.id} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: theme.ink.primary }}>{o.name}</Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{st.registered} of {st.total} registered</Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.border.default, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${st.total ? Math.round((st.registered / st.total) * 100) : 0}%`, backgroundColor: theme.brand.gold }} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          </View>
        </>
      ) : null}

      {seg === "bookings" ? (
        <View style={{ gap: 8 }}>
          {upcoming.map((b) => {
            const o = orgById(b.orgId); const sh = db.shoots[b.orgId]; const st = orgStats(db, b.orgId);
            return (
              <Pressable key={b.id} onPress={() => openOrg(b.orgId)} accessibilityRole="button">
                <Card style={{ padding: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={rowTitle}>{o?.name}</Text>
                    <Text style={[italic(13.5), { marginTop: 2 }]}>{sh?.label} · {dateLong(b.iso)} · {o?.type}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Badge label={b.status} tone={statusTone(b.status)} />
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{b.children} children expected · {st.registered} of {st.total} registered</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {seg === "tracker" ? (
        <View style={{ gap: 12 }}>
          <Text style={[italic(fs(15)), { color: theme.ink.secondary }]}>Set each organisation's phase. Their dashboard reads the change on the next visit.</Text>
          {db.orgs.map((o) => {
            const sh = db.shoots[o.id];
            if (!sh) return null;
            return (
              <Card key={o.id} style={{ padding: fs(18) }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={rowTitle}>{o.name}</Text>
                    <Text style={[italic(), { marginTop: 2 }]}>{sh.label} · {sh.date}</Text>
                  </View>
                  <Text style={[label9(theme.brand.gold), { fontSize: 9.5, maxWidth: "40%", textAlign: "right" }]}>{KIDS_PHASES[sh.phase]}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, flexGrow: 1 }}>
                  {KIDS_PHASES.map((p, i) => {
                    const on = i === sh.phase, done = i < sh.phase;
                    return (
                      <Pressable key={p} onPress={() => setPhase(o.id, i)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${o.name}: set phase ${p}`}
                        style={{ flexGrow: 1, flexBasis: 0, minWidth: 96, minHeight: 44, gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 3, borderColor: on ? theme.border.gold : theme.border.subtle, backgroundColor: on ? theme.brand.goldMuted : theme.surface.raised }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: done || on ? theme.brand.gold : theme.border.default }} />
                        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.9, fontSize: 9, lineHeight: 12, color: on ? theme.brand.gold : done ? theme.ink.secondary : theme.ink.tertiary }}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Card>
            );
          })}
        </View>
      ) : null}

      {seg === "inquiries" ? (
        <View style={{ flexDirection: twoPane ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
          <View style={{ flex: twoPane ? 1 : undefined, alignSelf: "stretch", gap: 8, minWidth: 0 }}>
            {inquiries.map((q) => {
              const st = inqState(q); const on = selInq?.id === q.id;
              return (
                <Pressable key={q.id} onPress={() => setInqId(q.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Card gold={on} style={{ padding: 16, backgroundColor: on ? theme.brand.goldMuted : theme.surface.raised, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={rowTitle}>{q.org}</Text>
                      <Text style={[italic(), { marginTop: 2 }]}>{q.type} · {q.count || "—"} children · {dateLong(q.received)}</Text>
                    </View>
                    <Badge label={INQ_LABELS[st]} tone={inqTone(st)} />
                  </Card>
                </Pressable>
              );
            })}
          </View>
          {selInq ? (() => {
            const st = inqState(selInq);
            const next = INQ_FLOW[st] ?? [];
            return (
              <Card gold style={{ flex: twoPane ? 1 : undefined, alignSelf: "stretch", padding: fs(20), gap: 14 }}>
                <Text style={label9()}>{selInq.type} · received {dateLong(selInq.received)}</Text>
                <Display size={22} style={{ color: theme.brand.gold }}>{selInq.org}</Display>
                <View style={{ gap: 6 }}>
                  {([["Contact", selInq.name], ["Email", selInq.email], ["Children", selInq.count || "—"], ["Dates", selInq.dates || "—"], ["Source", selInq.source]] as const).map(([k, v]) => (
                    <View key={k} style={{ flexDirection: "row", gap: 14 }}>
                      <Text style={{ width: 70, fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.tertiary }}>{k}</Text>
                      <Text selectable style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.primary }}>{v}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ borderLeftWidth: 2, borderLeftColor: theme.border.gold, paddingLeft: 12 }}>
                  <Text style={[italic(14), { color: theme.ink.secondary }]}>Organisation sees: “{INQ_MESSAGES[st]}”</Text>
                </View>
                {next.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {next.map((to) => (
                      <Button key={to} label={transitionLabel(st, to)} variant={to === "confirmed" || to === "awaiting_studio_confirmation" ? "primary" : "ghost"} onPress={() => transition(selInq.id, to, actor)} />
                    ))}
                  </View>
                ) : null}
                {selInq.audit.length ? (
                  <View style={{ gap: 5, borderTopWidth: 1, borderTopColor: theme.border.subtle, paddingTop: 10 }}>
                    <Text style={label9()}>Audit trail</Text>
                    {selInq.audit.map((a, i) => (
                      <Text key={i} style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, lineHeight: 16, color: theme.ink.tertiary }}>{a.at} · {a.actor} · {INQ_LABELS[a.from]} → {INQ_LABELS[a.to]}</Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })() : null}
        </View>
      ) : null}

      {seg === "orgs" ? (
        <View style={{ flexDirection: twoPane ? "row" : "column", gap: space.s5, alignItems: "flex-start" }}>
          <View style={{ flex: twoPane ? 1 : undefined, alignSelf: "stretch", gap: 8, minWidth: 0 }}>
            {db.orgs.map((o) => {
              const st = orgStats(db, o.id); const on = o.id === selOrg.id;
              return (
                <Pressable key={o.id} onPress={() => setOrgId(o.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Card gold={on} style={{ padding: 16, backgroundColor: on ? theme.brand.goldMuted : theme.surface.raised }}>
                    <Text style={rowTitle}>{o.name}</Text>
                    <Text style={[italic(), { marginTop: 2 }]}>{o.type} · {o.code}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.brand.gold, marginTop: 6 }}>{st.groups} {st.groups === 1 ? "group" : "groups"} · {st.registered} of {st.total} registered</Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flex: twoPane ? 1.4 : undefined, alignSelf: "stretch", gap: 12, minWidth: 0 }}>
            <Card style={{ padding: fs(20) }}>
              <Text style={label9()}>{selOrg.type} · {selOrg.code}</Text>
              <Display size={24} style={{ marginTop: 6 }}>{selOrg.name}</Display>
              <Text style={[italic(13.5), { marginTop: 4 }]}>{selOrg.manager}, {selOrg.managerRole} · {KIDS_PHASES[db.shoots[selOrg.id]?.phase ?? 0]}</Text>
            </Card>
            {db.groups.filter((g) => g.orgId === selOrg.id).map((g) => {
              // Only registered children are resolved to a name. Everyone else is a count.
              const registered = g.roster.filter((r) => r.childId).map((r) => db.children.find((c) => c.id === r.childId)).filter((c): c is NonNullable<typeof c> => !!c);
              const hidden = g.roster.filter((r) => !r.childId).length;
              return (
                <Card key={g.id} style={{ padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.ink.primary }}>{g.name}</Text>
                    <Badge label={g.kind} />
                  </View>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 17, color: theme.ink.tertiary }}>
                    {[`${g.lead} · ${g.leadRole}`, ...g.staff.map((s) => `${s.name} · ${s.role}`)].join("   ·   ")}
                  </Text>
                  {registered.map((c) => {
                    const sibs = siblingsOf(db, c);
                    return (
                      <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border.subtle }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: theme.ink.primary }}>{fullName(c)}</Text>
                          {sibs.length ? <Text style={italic(12.5)}>Sibling of {sibs.map(fullName).join(", ")}</Text> : null}
                        </View>
                        <Text selectable style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11.5, color: theme.brand.gold }}>{c.uid}</Text>
                      </View>
                    );
                  })}
                  {hidden ? <Text style={italic()}>{hidden} awaiting registration · names withheld until registration is complete</Text> : null}
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      {seg === "finance" ? (() => {
        const invoiced = invoices.reduce((n, i) => n + i.amount, 0);
        const received = invoices.filter((i) => i.status === "Paid").reduce((n, i) => n + i.amount, 0);
        const overdue = invoices.filter((i) => i.status === "Overdue").length;
        return (
          <>
            <Text style={[italic(fs(16)), { color: theme.ink.secondary }]}>Illuminate Kids books. None of this appears in the studio Finance view.</Text>
            <Kpis items={[
              { label: "Invoiced", value: aud(invoiced), hint: "Illuminate Kids only" },
              { label: "Received", value: aud(received), hint: "paid invoices" },
              { label: "Outstanding", value: aud(invoiced - received), hint: `${overdue} overdue`, accent: true },
              { label: "Expenses", value: aud(expenses.reduce((n, e) => n + e.amount, 0)), hint: "this period" },
            ]} />
            <SegStrip items={[["invoices", "Invoices"], ["expenses", "Expenses"]]} value={finSeg} onPick={setFinSeg} />
            {finSeg === "invoices" ? (
              <View style={{ gap: 8 }}>
                {invoices.map((i) => (
                  <Card key={i.id} style={{ padding: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 200 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: theme.ink.primary }}>
                        <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: theme.ink.tertiary }}>{i.id}</Text>{"  "}{orgById(i.orgId)?.name}
                      </Text>
                      <Text style={[italic(), { marginTop: 2 }]}>Issued {dateLong(i.issued)} · due {dateLong(i.due)}</Text>
                    </View>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.ink.primary }}>{aud(i.amount)}</Text>
                    <Badge label={i.status} tone={statusTone(i.status)} />
                    {i.status !== "Paid" ? <Button label="Mark paid" variant="ghost" onPress={() => markPaid(i.id)} /> : null}
                  </Card>
                ))}
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {expenses.map((e) => (
                  <Card key={e.id} style={{ padding: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1, minWidth: 200 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: theme.ink.primary }}>{e.supplier}</Text>
                      <Text style={[italic(), { marginTop: 2 }]}>{e.desc} · {dateLong(e.iso)}</Text>
                    </View>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.ink.primary }}>{aud(e.amount)}</Text>
                  </Card>
                ))}
              </View>
            )}
          </>
        );
      })() : null}
    </ScrollView>
  );
}
