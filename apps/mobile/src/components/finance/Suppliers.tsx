/**
 * Suppliers & service partners — the register of everyone the studio buys from.
 * ABN/ACN, registered address, contact, and the priced goods and services each
 * partner supplies. A GST credit only exists where the supplier is registered.
 */
import React from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Card, Badge, Button } from "~/components/ui";
import { Chip, Note, Mono } from "~/components/finance/parts";
import { Icon } from "~/components/Icon";
import { finAUD } from "~/data/finance";
import { useStudio } from "~/state/studio";
import {
  SUPPLIER_CATEGORIES, SUPPLIER_ENTITIES, digitsOnly, fmtDay, formatAbn, formatAcn,
  type Supplier, type SupplierItem,
} from "~/data/studio";

interface ItemDraft { desc: string; cost: string; unit: string }
interface Draft extends Omit<Supplier, "id" | "active" | "items" | "gst" | "since"> { id: string | null; gst: "yes" | "no"; items: ItemDraft[] }

const emptyDraft = (): Draft => ({
  id: null, name: "", entity: "Company (Pty Ltd)", abn: "", acn: "", gst: "yes", category: "Print & framing",
  address: "", phone: "", email: "", contactName: "", contactRole: "", contactPhone: "", contactEmail: "",
  terms: "Net 14 days", account: "", notes: "", items: [{ desc: "", cost: "", unit: "" }],
});

const draftOf = (v: Supplier): Draft => ({
  id: v.id, name: v.name, entity: v.entity, abn: v.abn, acn: v.acn, gst: v.gst ? "yes" : "no", category: v.category,
  address: v.address, phone: v.phone, email: v.email, contactName: v.contactName, contactRole: v.contactRole,
  contactPhone: v.contactPhone, contactEmail: v.contactEmail, terms: v.terms, account: v.account, notes: v.notes,
  items: [...v.items.map((i) => ({ desc: i.desc, cost: String(i.cost), unit: i.unit })), { desc: "", cost: "", unit: "" }],
});

const Field: React.FC<{ label?: string; value: string; onChange: (t: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean; basis?: number }> =
  ({ label, value, onChange, placeholder, numeric, multiline, basis = 240 }) => {
    const { theme, radius } = useTokens();
    return (
      <View style={{ gap: 6, flexGrow: 1, flexBasis: basis }}>
        {label ? <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text> : null}
        <TextInput
          value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.ink.tertiary}
          keyboardType={numeric ? "decimal-pad" : "default"} multiline={multiline}
          style={{ minHeight: multiline ? 74 : 46, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0,
            textAlignVertical: multiline ? "top" : "center", borderWidth: 1, borderColor: theme.border.default,
            borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }}
        />
      </View>
    );
  };

const ChipRow: React.FC<{ label: string; options: readonly string[]; value: string; onChange: (v: string) => void }> = ({ label, options, value, onChange }) => {
  const { theme } = useTokens();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
        {options.map((o) => <Chip key={o} label={o} on={o === value} onPress={() => onChange(o)} />)}
      </ScrollView>
    </View>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { theme } = useTokens();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Text style={{ width: 104, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.3, fontSize: 8.5, lineHeight: 13, color: theme.ink.tertiary }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{value}</Text>
    </View>
  );
};

export const Suppliers: React.FC<{ onRecordExpense?: (name: string) => void }> = ({ onRecordExpense }) => {
  const { theme, radius, space } = useTokens();
  const { width } = useResponsive();
  const { suppliers, upsertSupplier, toggleSupplierActive } = useStudio();
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  // Validation stays pinned beside the save button until the form is corrected.
  const [error, setError] = React.useState<string | null>(null);
  const fail = (m: string) => { setError(m); setFlash(m); setTimeout(() => setFlash(null), 4000); };
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 4000); };

  const twoCol = width >= 900;
  const q = query.trim().toLowerCase();
  const shown = suppliers.filter((v) => !q || `${v.name} ${v.category} ${v.abn} ${v.acn} ${v.contactName} ${v.items.map((i) => i.desc).join(" ")}`.toLowerCase().includes(q));
  const activeCount = suppliers.filter((v) => v.active).length;
  const gstCount = suppliers.filter((v) => v.gst).length;
  const lineCount = suppliers.reduce((t, v) => t + v.items.length, 0);
  const kpis: [string, string, string][] = [
    ["On the register", String(suppliers.length), `${activeCount} active · ${suppliers.length - activeCount} on hold`],
    ["GST registered", `${gstCount} of ${suppliers.length}`, "Only these carry a claimable GST credit"],
    ["Goods & services", String(lineCount), "Priced lines across every service partner"],
    ["Categories", String(new Set(suppliers.map((v) => v.category)).size), "Print, hire, advisory, insurance and travel"],
  ];

  const setItem = (i: number, k: keyof ItemDraft, val: string) => {
    setError(null);
    setDraft((d) => (d ? { ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, [k]: val } : it)) } : d));
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return fail("A business name is required");
    const abnD = digitsOnly(draft.abn), acnD = digitsOnly(draft.acn);
    if (!abnD && !acnD) return fail("An ABN or an ACN is required");
    if (abnD && abnD.length !== 11) return fail(`An ABN is 11 digits — ${abnD.length} entered`);
    if (acnD && acnD.length !== 9) return fail(`An ACN is 9 digits — ${acnD.length} entered`);
    if (!draft.contactName.trim()) return fail("A contact name is required");
    if (!draft.phone.trim() && !draft.contactPhone.trim()) return fail("A phone number is required");
    const items: SupplierItem[] = draft.items.filter((i) => i.desc.trim())
      .map((i) => ({ desc: i.desc.trim(), cost: parseFloat(i.cost) || 0, unit: i.unit.trim() || "per item" }));
    if (!items.length) return fail("List at least one service or good supplied");
    const existing = draft.id ? suppliers.find((v) => v.id === draft.id) : null;
    upsertSupplier({
      id: draft.id ?? `sp${suppliers.length + 1}-${Date.now().toString(36)}`,
      active: existing ? existing.active : true, name: draft.name.trim(), entity: draft.entity,
      abn: formatAbn(draft.abn), acn: formatAcn(draft.acn), gst: draft.gst === "yes", category: draft.category,
      address: draft.address.trim(), phone: draft.phone.trim(), email: draft.email.trim(),
      contactName: draft.contactName.trim(), contactRole: draft.contactRole.trim(),
      contactPhone: draft.contactPhone.trim(), contactEmail: draft.contactEmail.trim(),
      terms: draft.terms.trim() || "Net 14 days", account: draft.account.trim() || "—",
      since: existing?.since ?? "2026-05-14", items, notes: draft.notes.trim(),
    });
    say(draft.id ? `${draft.name} updated` : `${draft.name} added to the supplier register`);
    setError(null);
    setDraft(null);
  };

  return (
    <View style={{ gap: space.s4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {kpis.map(([label, value, hint]) => (
          <Card key={label} style={{ padding: 18, flexGrow: 1, flexBasis: 180 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 27, color: theme.ink.primary, marginTop: 8, marginBottom: 3 }}>{value}</Text>
            <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 13, lineHeight: 18, color: theme.ink.tertiary }}>{hint}</Text>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <TextInput
          value={query} onChangeText={setQuery} placeholder="Search supplier, ABN, contact or service…" placeholderTextColor={theme.ink.tertiary}
          style={{ flexGrow: 1, flexBasis: 220, minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default,
            borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }}
        />
        <Button label="Add supplier" onPress={() => { setError(null); setDraft(emptyDraft()); }} />
      </View>

      {flash ? <Note>{flash}</Note> : null}

      {draft ? (
        <Card gold style={{ padding: 18, gap: 16 }}>
          <Eyebrow>{draft.id ? "Edit supplier record" : "New supplier or service partner"}</Eyebrow>
          <Field label="Registered business name · required" value={draft.name} onChange={(t) => setDraft({ ...draft, name: t })} placeholder="e.g. Hunter & Vale Print Atelier" basis={320} />
          <ChipRow label="Entity type" options={SUPPLIER_ENTITIES} value={draft.entity} onChange={(v) => setDraft({ ...draft, entity: v })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field numeric label="ABN · 11 digits" value={draft.abn} onChange={(t) => setDraft({ ...draft, abn: t })} placeholder="61 452 907 118" />
            <Field numeric label="ACN · 9 digits" value={draft.acn} onChange={(t) => setDraft({ ...draft, acn: t })} placeholder="452 907 118" />
          </View>
          <Note>
            {draft.entity === "Company (Pty Ltd)"
              ? "Companies must record an ACN as well as an ABN. At least one of the two is required before the record will save."
              : "An ACN applies only to incorporated companies — leave it blank otherwise. At least one of the two is required before the record will save."}
          </Note>
          <ChipRow label="GST status" options={["Registered for GST", "Not registered"]}
            value={draft.gst === "yes" ? "Registered for GST" : "Not registered"}
            onChange={(v) => setDraft({ ...draft, gst: v === "Registered for GST" ? "yes" : "no" })} />
          <Field label="Registered address" value={draft.address} onChange={(t) => setDraft({ ...draft, address: t })} placeholder="Street, suburb, state, postcode" basis={320} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field label="Business phone" value={draft.phone} onChange={(t) => setDraft({ ...draft, phone: t })} placeholder="+61 3 …" />
            <Field label="Accounts email" value={draft.email} onChange={(t) => setDraft({ ...draft, email: t })} placeholder="orders@supplier.com.au" />
            <Field label="Contact name · required" value={draft.contactName} onChange={(t) => setDraft({ ...draft, contactName: t })} placeholder="Who the studio deals with" />
            <Field label="Contact position" value={draft.contactRole} onChange={(t) => setDraft({ ...draft, contactRole: t })} placeholder="e.g. Account Manager" />
            <Field label="Contact number" value={draft.contactPhone} onChange={(t) => setDraft({ ...draft, contactPhone: t })} placeholder="+61 4…" />
            <Field label="Contact email" value={draft.contactEmail} onChange={(t) => setDraft({ ...draft, contactEmail: t })} placeholder="name@supplier.com.au" />
          </View>
          <ChipRow label="Category" options={SUPPLIER_CATEGORIES} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />

          <View style={{ height: 1, backgroundColor: theme.border.subtle }} />
          <Eyebrow>Goods &amp; services supplied · cost per line</Eyebrow>
          {draft.items.map((it, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: theme.border.subtle, borderRadius: radius.xs, backgroundColor: theme.surface.inset, padding: 14, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>Line {i + 1}</Text>
                <Pressable accessibilityLabel="Remove line" onPress={() => setDraft({ ...draft, items: draft.items.length > 1 ? draft.items.filter((_, idx) => idx !== i) : [{ desc: "", cost: "", unit: "" }] })}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="trash" size={15} color={theme.ink.tertiary} />
                </Pressable>
              </View>
              <Field value={it.desc} onChange={(t) => setItem(i, "desc", t)} placeholder="Service or good supplied" basis={280} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <Field numeric value={it.cost} onChange={(t) => setItem(i, "cost", t)} placeholder="Cost $" basis={140} />
                <Field value={it.unit} onChange={(t) => setItem(i, "unit", t)} placeholder="per print / per day / per quarter" basis={200} />
              </View>
            </View>
          ))}
          <Button label="Add another line" variant="ghost" onPress={() => setDraft({ ...draft, items: [...draft.items, { desc: "", cost: "", unit: "" }] })} />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field label="Payment terms" value={draft.terms} onChange={(t) => setDraft({ ...draft, terms: t })} placeholder="Net 14 days" />
            <Field label="Studio account number" value={draft.account} onChange={(t) => setDraft({ ...draft, account: t })} placeholder="ILLUM-0000" />
          </View>
          <Field multiline label="Notes" value={draft.notes} onChange={(t) => setDraft({ ...draft, notes: t })} placeholder="Lead times, quote validity, anything the studio should remember" basis={320} />
          {error ? (
            <Text accessibilityRole="alert" style={{ fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, color: theme.status.warning }}>{error}</Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Button label={draft.id ? "Save supplier" : "Add to register"} onPress={save} />
            <Button label="Cancel" variant="ghost" onPress={() => { setError(null); setDraft(null); }} />
          </View>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {shown.map((v) => (
          <Card key={v.id} style={{ padding: 18, flexGrow: 1, flexBasis: twoCol ? 340 : "100%", opacity: v.active ? 1 : 0.72 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flexGrow: 1, flexBasis: 150, gap: 3 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: theme.ink.primary }}>{v.name}</Text>
                <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 14, color: theme.brand.gold }}>{v.category} · {v.entity}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Badge label={v.active ? "Active" : "On hold"} tone={v.active ? "success" : "muted"} />
                <Badge label={v.gst ? "GST registered" : "No GST"} tone={v.gst ? "gold" : "muted"} />
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Mono size={11} color={theme.ink.secondary}>
                {[v.abn ? "ABN " + v.abn : "", v.acn ? "ACN " + v.acn : ""].filter(Boolean).join("   ·   ") || "—"}
              </Mono>
            </View>

            <View style={{ gap: 9, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: theme.border.subtle }}>
              <Fact label="Registered address" value={v.address || "—"} />
              <Fact label="Business phone" value={v.phone || "—"} />
              <Fact label="Account email" value={v.email || "—"} />
              <Fact label="Contact" value={v.contactName + (v.contactRole ? " · " + v.contactRole : "")} />
              <Fact label="Contact number" value={[v.contactPhone, v.contactEmail].filter(Boolean).join(" · ") || "—"} />
              <Fact label="Terms" value={`${v.terms} · account ${v.account}`} />
            </View>

            <View style={{ gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: theme.border.subtle }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>Goods &amp; services supplied</Text>
              {v.items.map((i) => (
                <View key={i.desc} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{i.desc}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 15, color: theme.ink.primary }}>{finAUD(i.cost)}</Text>
                    <Mono size={9.5}>{i.unit}</Mono>
                  </View>
                </View>
              ))}
            </View>

            {v.notes ? <Note>{v.notes}</Note> : null}
            <View style={{ marginTop: 10 }}><Mono size={10}>On the register since {fmtDay(v.since)}</Mono></View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              <Button label="Edit" variant="ghost" onPress={() => { setError(null); setDraft(draftOf(v)); }} />
              <Button label="Record expense" onPress={() => { onRecordExpense?.(v.name); say(`Expense started against ${v.name}`); }} />
              <Button label={v.active ? "Place on hold" : "Reactivate"} variant="ghost"
                onPress={() => { toggleSupplierActive(v.id); say(v.active ? `${v.name} placed on hold` : `${v.name} reactivated`); }} />
            </View>
          </Card>
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={{ padding: 40, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border.default, borderRadius: radius.sm }}>
          <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.ink.secondary }}>No matching suppliers</Text>
        </View>
      ) : null}

      <Note>A GST credit can only be claimed where the supplier is registered for GST and the purchase is supported by a valid tax invoice showing their ABN.</Note>
    </View>
  );
};
