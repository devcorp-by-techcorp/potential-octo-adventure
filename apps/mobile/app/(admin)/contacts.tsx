/**
 * Contacts — the studio directory, in three tabs.
 *
 *  Contacts  one fuzzy search across every client, enquiry, partner and
 *            supplier on file, and where anyone new is added.
 *  Clients   past, current and potential clients as an alphabetical index
 *            (by surname), with a stage filter and type-to-autocomplete over
 *            first name, last name, phone and email.
 *  Partners  suppliers and service partners as an alphabetical index, with a
 *            type-of-business filter and autocomplete over business name, ABN,
 *            ACN, phone and email.
 *
 * Finance → Suppliers' "Add partner" lands here with the partner form open:
 * one intake point for everyone the studio deals with.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateShort, initials } from "~/data/seed";
import { fuzzyHint } from "~/data/enquiry";
import {
  clientRecords, partnerRecords, clientFields, partnerFields, rank, groupByLetter, lettersOf, STAGES,
  type ClientRec, type PartnerRec, type Stage,
} from "~/data/directory";
import { SUPPLIER_CATEGORIES, digitsOnly, formatAbn, formatAcn } from "~/data/studio";
import { useRecords } from "~/state/records";
import { useStudio } from "~/state/studio";

type Tab = "contacts" | "clients" | "partners";
const TAGS = ["VIP", "Returning", "Destination", "Prospect", "Corporate", "Referral"];
const STAGE_TONE: Record<Stage, "success" | "muted" | "gold"> = { Current: "success", Past: "muted", Potential: "gold" };
const INTRO: Record<Tab, string> = {
  contacts: "One search across every contact, service and supplier on file — and where anyone new is added.",
  clients: "Every client the studio has worked with, is working with, or has heard from — indexed by surname. Type any part of a name, number or email.",
  partners: "Suppliers, services and referral partners — engaged, past and enquired-with. Filter by type of business, or search a name, ABN, ACN, number or email.",
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const BLANK_CONTACT = { name: "", email: "", phone: "", tags: [] as string[] };
const BLANK_PARTNER = { name: "", category: SUPPLIER_CATEGORIES[0], abn: "", acn: "", contactName: "", phone: "", email: "", prospect: false };

export default function Contacts() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; add?: string }>();
  const { contacts, bookings, inquiries, addContact, toggleContactAssigned } = useRecords();
  const { suppliers, upsertSupplier } = useStudio();

  const pTab = one(params.tab), pAdd = one(params.add);
  const [tab, setTab] = React.useState<Tab>(pTab === "clients" || pTab === "partners" ? pTab : "contacts");
  const [form, setForm] = React.useState<"contact" | "partner" | null>(pAdd === "partner" || pAdd === "contact" ? pAdd : null);
  React.useEffect(() => { if (pAdd === "partner" || pAdd === "contact") { setTab("contacts"); setForm(pAdd); } }, [pAdd]);

  const [query, setQuery] = React.useState("");
  const [clQuery, setClQuery] = React.useState(""); const [clLetter, setClLetter] = React.useState("all"); const [clStage, setClStage] = React.useState<Stage | "all">("all");
  const [pnQuery, setPnQuery] = React.useState(""); const [pnLetter, setPnLetter] = React.useState("all"); const [pnType, setPnType] = React.useState("all");
  const [cDraft, setCDraft] = React.useState(BLANK_CONTACT);
  const [pDraft, setPDraft] = React.useState(BLANK_PARTNER);
  const [error, setError] = React.useState("");
  const [flash, setFlash] = React.useState("");
  const [profileId, setProfileId] = React.useState<string | null>(null);

  const clients = React.useMemo(() => clientRecords(contacts, bookings, inquiries), [contacts, bookings, inquiries]);
  const partners = React.useMemo(() => partnerRecords(suppliers), [suppliers]);

  const openClient = (r: ClientRec) => {
    if (r.kind === "contact") return setProfileId(r.id);
    if (r.kind === "inquiry") return router.push({ pathname: "/(admin)/inquiries", params: { inquiry: r.id } });
    router.push({ pathname: "/(admin)/finance", params: { tab: "invoices" } });
  };
  const openPartner = (r: PartnerRec) => router.push({ pathname: "/(admin)/finance", params: { tab: "suppliers", q: r.name } });

  const saveContact = () => {
    const r = addContact(cDraft);
    if (!r.ok) return setError(r.error);
    setFlash(`${cDraft.name.trim()} added to the contact book.`); setCDraft(BLANK_CONTACT); setError(""); setForm(null);
  };
  const savePartner = () => {
    const abn = digitsOnly(pDraft.abn), acn = digitsOnly(pDraft.acn);
    if (!pDraft.name.trim()) return setError("A business name is required.");
    if (!abn && !acn) return setError("An ABN or an ACN is required.");
    if (abn && abn.length !== 11) return setError(`An ABN is 11 digits — ${abn.length} entered.`);
    if (acn && acn.length !== 9) return setError(`An ACN is 9 digits — ${acn.length} entered.`);
    if (!pDraft.phone.trim() && !pDraft.email.trim()) return setError("A phone number or an email is required.");
    upsertSupplier({
      id: `sp${suppliers.length + 1}-${Date.now().toString(36)}`, active: true, prospect: pDraft.prospect,
      name: pDraft.name.trim(), entity: acn ? "Company (Pty Ltd)" : "Sole trader", abn: abn ? formatAbn(pDraft.abn) : "", acn: acn ? formatAcn(pDraft.acn) : "",
      gst: true, category: pDraft.category, address: "", phone: pDraft.phone.trim(), email: pDraft.email.trim(),
      contactName: pDraft.contactName.trim(), contactRole: "", contactPhone: "", contactEmail: "",
      terms: "Net 14 days", account: "—", since: "2026-05-14", items: [], notes: "",
    });
    setFlash(`${pDraft.name.trim()} added. Address, terms and price list are completed in Finance → Suppliers.`);
    setPDraft(BLANK_PARTNER); setError(""); setForm(null);
  };

  // ── shared pieces ──
  const label9 = { fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 1.5, fontSize: 9, color: theme.ink.tertiary };
  const inputStyle = { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, fontFamily: "Inter_400Regular", fontSize: 15, color: theme.ink.primary };
  const half = { flexBasis: width >= 620 ? "47%" : "100%", flexGrow: 1 } as const;

  // A plain render helper, not a component: a component declared here would remount on every keystroke and drop focus.
  const search = (value: string, onChange: (t: string) => void, placeholder: string) => (
    <View style={{ maxWidth: 520 }}>
      <View style={{ position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}><Icon name="search" size={16} color={theme.ink.tertiary} /></View>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.ink.tertiary} accessibilityLabel={placeholder} autoCorrect={false} autoCapitalize="none"
        style={[inputStyle, { paddingLeft: 40 }]} />
    </View>
  );
  const Chip = ({ label, on, onPress, mono }: { label: string; on: boolean; onPress: () => void; mono?: boolean }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: mono ? 0 : 14, alignItems: "center", justifyContent: "center", borderRadius: mono ? 3 : 999, borderWidth: 1, borderColor: on ? theme.brand.gold : theme.border.default, backgroundColor: on ? theme.brand.gold : theme.surface.raised }}>
      <Text style={{ fontFamily: mono ? "JetBrainsMono_400Regular" : "Inter_600SemiBold", fontSize: 11, letterSpacing: mono ? 0 : 0.5, color: on ? theme.ink.inverse : theme.ink.secondary }}>{label}</Text>
    </Pressable>
  );
  const Strip = ({ children }: { children: React.ReactNode }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>{children}</ScrollView>
  );
  const Row = ({ name, meta, line, stage, onPress }: { name: string; meta: string; line: string; stage: Stage; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${stage}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 62, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: radius.sm, backgroundColor: theme.surface.raised }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface.inset, borderWidth: 1, borderColor: theme.border.default }}>
        <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 12, color: theme.brand.gold }}>{initials(name) || "—"}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13.5), color: theme.ink.primary }}>{name}</Text>
        <Text numberOfLines={1} style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary, marginTop: 1 }}>{meta}</Text>
        <Text numberOfLines={1} style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, color: theme.ink.tertiary, marginTop: 2 }}>{line}</Text>
      </View>
      <Badge label={stage} tone={STAGE_TONE[stage]} />
    </Pressable>
  );
  const clientRow = (r: ClientRec) => <Row key={r.kind + r.id} name={r.name} meta={r.meta} stage={r.stage} onPress={() => openClient(r)} line={[r.phone, r.email].filter(Boolean).join("   ·   ") || "No phone or email on file"} />;
  const partnerRow = (r: PartnerRec) => <Row key={r.id} name={r.name} meta={r.type + (r.contact ? ` · ${r.contact}` : "")} stage={r.stage} onPress={() => openPartner(r)} line={[r.phone, r.email, r.abn ? `ABN ${r.abn}` : "", r.acn ? `ACN ${r.acn}` : ""].filter(Boolean).join("   ·   ") || "—"} />;
  const Suggest = ({ items }: { items: { key: string; name: string; hint: string; pick: () => void }[] }) => (items.length ? (
    <Card style={{ maxWidth: 520, overflow: "hidden" }}>
      {items.map((s, i) => (
        <Pressable key={s.key} onPress={s.pick} accessibilityRole="button" accessibilityLabel={`${s.name}. ${s.hint}`}
          style={{ minHeight: 50, paddingVertical: 9, paddingHorizontal: 14, justifyContent: "center", borderTopWidth: i ? 1 : 0, borderTopColor: theme.border.subtle }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: theme.ink.primary }}>{s.name}</Text>
          <Text numberOfLines={1} style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, color: theme.ink.tertiary, marginTop: 2 }}>{s.hint}</Text>
        </Pressable>
      ))}
    </Card>
  ) : null);
  const Empty = ({ text }: { text: string }) => <Card style={{ padding: 30, alignItems: "center" }}><Display size={19}>{text}</Display></Card>;
  const Letters = ({ letters, value, onPick }: { letters: string[]; value: string; onPick: (l: string) => void }) => (
    <Strip>{["all", ...letters].map((l) => <Chip key={l} mono label={l === "all" ? "ALL" : l} on={value === l} onPress={() => onPick(l)} />)}</Strip>
  );
  const Groups = <T extends { letter: string; sortKey: string }>({ recs, render, empty }: { recs: T[]; render: (r: T) => React.ReactNode; empty: string }) => {
    const groups = groupByLetter(recs);
    if (!groups.length) return <Empty text={empty} />;
    return (
      <View style={{ gap: space.s4 }}>
        {groups.map((g) => (
          <View key={g.letter} style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border.subtle, paddingBottom: 6 }}>
              <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 24, color: theme.brand.gold }}>{g.letter}</Text>
              <Text style={label9}>{g.rows.length}</Text>
            </View>
            {g.rows.map(render)}
          </View>
        ))}
      </View>
    );
  };

  const profile = profileId ? contacts.find((c) => c.id === profileId) ?? null : null;
  const profileBooking = profile ? bookings.find((b) => b.id === profile.bookingId) ?? null : null;

  // ── per-tab data ──
  const dirClients = rank(clients, query, clientFields).slice(0, query.trim() ? 12 : 6);
  const dirPartners = rank(partners, query, partnerFields).slice(0, query.trim() ? 12 : 6);
  const clRanked = rank(clients, clQuery, clientFields);
  const clScoped = clRanked.filter((r) => (clStage === "all" || r.stage === clStage) && (clLetter === "all" || r.letter === clLetter));
  const pnRanked = rank(partners, pnQuery, partnerFields);
  const pnScoped = pnRanked.filter((r) => (pnType === "all" || r.type === pnType) && (pnLetter === "all" || r.letter === pnLetter));
  const pnTypes = [...new Set(partners.map((r) => r.type))].sort();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: gutter, gap: space.s5 }}>
      <View>
        <Eyebrow>Studio directory</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8, maxWidth: 640 }}>{INTRO[tab]}</Body>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: theme.border.subtle }} contentContainerStyle={{ gap: 4 }}>
        {([["contacts", "Contacts", clients.length + partners.length], ["clients", "Clients", clients.length], ["partners", "Partners", partners.length]] as const).map(([k, label, count]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => { setTab(k); setError(""); setFlash(""); }} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} accessibilityLabel={`${label}, ${count}`}
              style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 2, borderBottomColor: on ? theme.brand.gold : "transparent" }}>
              <Text style={{ fontFamily: on ? "Inter_600SemiBold" : "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(10.5), color: on ? theme.brand.gold : theme.ink.tertiary }}>{label}</Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: theme.ink.tertiary }}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {flash ? (
        <View accessibilityRole="alert" style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border.gold, borderRadius: radius.xs, backgroundColor: theme.brand.goldMuted }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, color: theme.ink.primary }}>{flash}</Text>
        </View>
      ) : null}

      {tab === "contacts" ? (
        <>
          {search(query, setQuery, "Search clients, enquiries, partners and suppliers")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Button label="Add contact" icon="plus" variant={form === "contact" ? "primary" : "ghost"} onPress={() => { setForm(form === "contact" ? null : "contact"); setError(""); setFlash(""); }} />
            <Button label="Add partner or supplier" icon="plus" variant={form === "partner" ? "primary" : "ghost"} onPress={() => { setForm(form === "partner" ? null : "partner"); setError(""); setFlash(""); }} />
          </View>

          {form === "contact" ? (
            <Card gold style={{ padding: fs(20), gap: 14 }}>
              <Display size={22}>New contact</Display>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Full name · required</Text><TextInput value={cDraft.name} onChangeText={(t) => { setCDraft({ ...cDraft, name: t }); setError(""); }} accessibilityLabel="Contact full name" autoCapitalize="words" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Email · required</Text><TextInput value={cDraft.email} onChangeText={(t) => { setCDraft({ ...cDraft, email: t }); setError(""); }} accessibilityLabel="Contact email" keyboardType="email-address" autoCapitalize="none" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Phone</Text><TextInput value={cDraft.phone} onChangeText={(t) => setCDraft({ ...cDraft, phone: t })} accessibilityLabel="Contact phone" keyboardType="phone-pad" style={inputStyle} /></View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={label9}>Tags</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {TAGS.map((t) => { const on = cDraft.tags.includes(t); return <Chip key={t} label={t} on={on} onPress={() => setCDraft({ ...cDraft, tags: on ? cDraft.tags.filter((x) => x !== t) : [...cDraft.tags, t] })} />; })}
                </View>
              </View>
              {error ? <ErrorLine text={error} /> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Button label="Add to contact book" onPress={saveContact} />
                <Button label="Cancel" variant="ghost" onPress={() => { setForm(null); setError(""); }} />
              </View>
            </Card>
          ) : null}

          {form === "partner" ? (
            <Card gold style={{ padding: fs(20), gap: 14 }}>
              <Display size={22}>New partner or supplier</Display>
              <Body muted size={12.5}>The record lands on the supplier register. Address, payment terms and the price list are completed in Finance → Suppliers.</Body>
              <View style={{ gap: 6 }}><Text style={label9}>Business name · required</Text><TextInput value={pDraft.name} onChangeText={(t) => { setPDraft({ ...pDraft, name: t }); setError(""); }} accessibilityLabel="Business name" style={inputStyle} /></View>
              <View style={{ gap: 8 }}>
                <Text style={label9}>Type of business</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SUPPLIER_CATEGORIES.map((c) => <Chip key={c} label={c} on={pDraft.category === c} onPress={() => setPDraft({ ...pDraft, category: c })} />)}
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={[half, { gap: 6 }]}><Text style={label9}>ABN · 11 digits</Text><TextInput value={pDraft.abn} onChangeText={(t) => { setPDraft({ ...pDraft, abn: t }); setError(""); }} accessibilityLabel="ABN" keyboardType="number-pad" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>ACN · 9 digits</Text><TextInput value={pDraft.acn} onChangeText={(t) => { setPDraft({ ...pDraft, acn: t }); setError(""); }} accessibilityLabel="ACN" keyboardType="number-pad" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Contact name</Text><TextInput value={pDraft.contactName} onChangeText={(t) => setPDraft({ ...pDraft, contactName: t })} accessibilityLabel="Partner contact name" autoCapitalize="words" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Phone</Text><TextInput value={pDraft.phone} onChangeText={(t) => { setPDraft({ ...pDraft, phone: t }); setError(""); }} accessibilityLabel="Partner phone" keyboardType="phone-pad" style={inputStyle} /></View>
                <View style={[half, { gap: 6 }]}><Text style={label9}>Email</Text><TextInput value={pDraft.email} onChangeText={(t) => { setPDraft({ ...pDraft, email: t }); setError(""); }} accessibilityLabel="Partner email" keyboardType="email-address" autoCapitalize="none" style={inputStyle} /></View>
              </View>
              <View style={{ gap: 8 }}>
                <Text style={label9}>Relationship</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Chip label="Engaged now" on={!pDraft.prospect} onPress={() => setPDraft({ ...pDraft, prospect: false })} />
                  <Chip label="Enquiry only" on={pDraft.prospect} onPress={() => setPDraft({ ...pDraft, prospect: true })} />
                </View>
              </View>
              {error ? <ErrorLine text={error} /> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <Button label="Add to register" onPress={savePartner} />
                <Button label="Cancel" variant="ghost" onPress={() => { setForm(null); setError(""); }} />
              </View>
            </Card>
          ) : null}

          <View style={{ gap: 8 }}>
            <Eyebrow>{`Clients and enquiries · ${query.trim() ? dirClients.length + " matching" : "first " + dirClients.length}`}</Eyebrow>
            {dirClients.length ? dirClients.map(clientRow) : <Empty text="No matching clients" />}
          </View>
          <View style={{ gap: 8 }}>
            <Eyebrow>{`Partners and suppliers · ${query.trim() ? dirPartners.length + " matching" : "first " + dirPartners.length}`}</Eyebrow>
            {dirPartners.length ? dirPartners.map(partnerRow) : <Empty text="No matching partners" />}
          </View>
        </>
      ) : null}

      {tab === "clients" ? (
        <>
          {search(clQuery, setClQuery, "Type a first name, last name, phone or email")}
          <Suggest items={clQuery.trim() ? clRanked.slice(0, 5).map((r) => ({ key: r.kind + r.id, name: r.name, pick: () => openClient(r), hint: fuzzyHint([["Name", r.name], ["Email", r.email], ["Phone", r.phone]], clQuery) || r.meta })) : []} />
          <Strip>{(["all", ...STAGES] as const).map((s) => <Chip key={s} label={s === "all" ? "Everyone" : s} on={clStage === s} onPress={() => setClStage(s)} />)}</Strip>
          <Letters letters={lettersOf(clients)} value={clLetter} onPick={setClLetter} />
          <Groups recs={clScoped} render={clientRow} empty="No matching clients" />
        </>
      ) : null}

      {tab === "partners" ? (
        <>
          {search(pnQuery, setPnQuery, "Type a business name, ABN, ACN, phone or email")}
          <Suggest items={pnQuery.trim() ? pnRanked.slice(0, 5).map((r) => ({ key: r.id, name: r.name, pick: () => openPartner(r), hint: fuzzyHint([["Business", r.name], ["ABN", r.abn], ["ACN", r.acn], ["Email", r.email], ["Phone", r.phone], ["Type", r.type]], pnQuery) || r.type })) : []} />
          <View style={{ gap: 6 }}>
            <Text style={label9}>Type of business</Text>
            <Strip>{["all", ...pnTypes].map((t) => <Chip key={t} label={t === "all" ? "All types" : t} on={pnType === t} onPress={() => setPnType(t)} />)}</Strip>
          </View>
          <Letters letters={lettersOf(partners)} value={pnLetter} onPick={setPnLetter} />
          <Groups recs={pnScoped} render={partnerRow} empty="No matching partners" />
        </>
      ) : null}

      {/* Client profile — the full record behind a contact row. */}
      <Modal visible={!!profile} transparent animationType={width >= 760 ? "fade" : "slide"} onRequestClose={() => setProfileId(null)}>
        <Pressable onPress={() => setProfileId(null)} accessibilityLabel="Close profile" style={{ flex: 1, backgroundColor: theme.scrim, flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} accessibilityViewIsModal style={{ width: width >= 760 ? "66.666%" : "100%", height: "100%", backgroundColor: theme.surface.canvas, borderLeftWidth: 1, borderLeftColor: theme.border.gold }}>
            {profile ? (
              <ScrollView contentContainerStyle={{ padding: gutter, paddingTop: gutter + 24, gap: space.s4 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Eyebrow>Client profile</Eyebrow>
                    <Display size={28} style={{ marginTop: 6 }}>{profile.name}</Display>
                    <Text selectable style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11.5, color: theme.ink.tertiary, marginTop: 6 }}>{[profile.email, profile.phone].filter(Boolean).join("   ·   ")}</Text>
                  </View>
                  <Pressable onPress={() => setProfileId(null)} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Icon name="close" size={20} color={theme.ink.tertiary} /></Pressable>
                </View>
                <Card style={{ padding: 18, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={label9}>Client portal</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.primary, marginTop: 4 }}>{profile.assigned ? "Portal account is active." : "No portal account."}</Text>
                  </View>
                  <Pressable onPress={() => toggleContactAssigned(profile.id)} accessibilityRole="switch" accessibilityState={{ checked: profile.assigned }} aria-checked={profile.assigned} accessibilityLabel="Portal account" style={{ minHeight: 44, justifyContent: "center" }}>
                    <Badge label={profile.assigned ? "Portal active" : "No portal"} tone={profile.assigned ? "success" : "muted"} />
                  </Pressable>
                </Card>
                <Card style={{ padding: 18 }}>
                  <Text style={label9}>Booking</Text>
                  {profileBooking ? (
                    <>
                      <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: theme.ink.primary, marginTop: 6 }}>{profileBooking.clientName}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12.5, color: theme.brand.gold, marginTop: 4 }}>{profileBooking.eventType} · {dateShort(profileBooking.date)} · {profileBooking.venue}</Text>
                      <View style={{ marginTop: 12 }}><Button label="Open booking" variant="ghost" icon="calendar" onPress={() => { setProfileId(null); router.push({ pathname: "/(admin)/bookings", params: { booking: profileBooking.id } }); }} /></View>
                    </>
                  ) : <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: theme.ink.tertiary, marginTop: 6 }}>No booking on file.</Text>}
                </Card>
                {profile.tags.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{profile.tags.map((t) => <Badge key={t} label={t} tone="gold" />)}</View>
                ) : null}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function ErrorLine({ text }: { text: string }) {
  const { theme } = useTokens();
  return (
    <View accessibilityRole="alert" style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 2, borderWidth: 1, borderColor: theme.status.warning, backgroundColor: "rgba(212,163,86,0.12)" }}>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{text}</Text>
    </View>
  );
}
