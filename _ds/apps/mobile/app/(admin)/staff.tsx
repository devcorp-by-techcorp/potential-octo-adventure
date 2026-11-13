/**
 * Studio Staff — the employment roster and the contracts behind it.
 * Names, hired positions, pay rates, superannuation and agreements for
 * everyone the studio engages. Leavers are retained, never deleted.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Body, Card, Badge, Button } from "~/components/ui";
import { Seg, SegBar, Chip, Note, Mono } from "~/components/finance/parts";
import { useStudio } from "~/state/studio";
import {
  CONTRACT_STATUSES, CONTRACT_TYPES, ENGAGEMENT_TYPES, PAY_BASES,
  contractTone, fmtDay, initialsOf, staffContractFlag, staffPayLabel, staffWeekly,
  type ContractStatus, type EngagementType, type PayBasis, type StaffMember,
} from "~/data/studio";

const money0 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

interface Draft {
  id: string | null; identityKey: StaffMember["identityKey"]; name: string; position: string;
  type: EngagementType; start: string; payBasis: PayBasis; rate: string; hours: string; superPct: string;
  award: string; email: string; phone: string; abn: string;
  contractType: string; contractRef: string; contractStatus: ContractStatus; contractSigned: string; contractExpires: string;
  notes: string;
}

const emptyDraft = (n: number): Draft => ({
  id: null, identityKey: null, name: "", position: "", type: "Employee · Full-time", start: "2026-05-14",
  payBasis: "Salary", rate: "", hours: "38", superPct: "12", award: "", email: "", phone: "", abn: "",
  contractType: "Employment Agreement", contractRef: "EMP-" + String(1000 + n).slice(1),
  contractStatus: "Awaiting signature", contractSigned: "", contractExpires: "Ongoing", notes: "",
});

const draftOf = (p: StaffMember): Draft => ({
  id: p.id, identityKey: p.identityKey, name: p.name, position: p.position, type: p.type, start: p.start,
  payBasis: p.payBasis, rate: String(p.rate), hours: String(p.hours), superPct: String(p.superPct),
  award: p.award, email: p.email, phone: p.phone, abn: p.abn,
  contractType: p.contract.type, contractRef: p.contract.ref, contractStatus: p.contract.status,
  contractSigned: p.contract.signed, contractExpires: p.contract.expires, notes: p.notes,
});

const Field: React.FC<{ label: string; value: string; onChange: (t: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean }> =
  ({ label, value, onChange, placeholder, numeric, multiline }) => {
    const { theme, radius } = useTokens();
    return (
      <View style={{ gap: 6, flexGrow: 1, flexBasis: 240 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text>
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
      <Text style={{ width: 98, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.3, fontSize: 8.5, lineHeight: 13, color: theme.ink.tertiary }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{value}</Text>
    </View>
  );
};

export default function StudioStaff() {
  const { theme, radius, space } = useTokens();
  const { gutter, width } = useResponsive();
  const { roster, upsertStaff, toggleStaffActive } = useStudio();
  const [tab, setTab] = React.useState<"roster" | "contracts">("roster");
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  // Validation stays pinned beside the save button until the form is corrected,
  // rather than disappearing with a transient message.
  const [error, setError] = React.useState<string | null>(null);
  const fail = (m: string) => { setError(m); setFlash(m); setTimeout(() => setFlash(null), 4000); };
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 4000); };

  const twoCol = width >= 900;
  const active = roster.filter((p) => p.active);
  const q = query.trim().toLowerCase();
  const shown = roster.filter((p) => !q || `${p.name} ${p.position} ${p.type} ${p.contract.ref} ${p.award}`.toLowerCase().includes(q));

  const weekly = active.reduce((t, p) => t + staffWeekly(p), 0);
  const weeklySuper = active.reduce((t, p) => t + staffWeekly(p) * (p.superPct / 100), 0);
  const flagged = roster.filter(staffContractFlag);
  const kpis: [string, string, string][] = [
    ["On the books", String(active.length),
      `${active.filter((p) => p.type.startsWith("Employee")).length} employed · ${active.filter((p) => p.type === "Casual").length} casual · ${active.filter((p) => p.type === "Contractor").length} contracted`],
    ["Weekly wages", money0(weekly), "Salaries and rostered hours · excludes per-shoot engagements"],
    ["Super · weekly", money0(weeklySuper), "Guarantee accruing on ordinary earnings"],
    ["Contracts to action", String(flagged.length), flagged.length ? "Awaiting signature or nearing expiry" : "All current and signed"],
  ];

  const save = () => {
    if (!draft) return;
    const rate = parseFloat(draft.rate) || 0;
    if (!draft.name.trim()) return fail("A staff name is required");
    if (!draft.position.trim()) return fail("A position or role is required");
    if (rate <= 0) return fail("A pay rate is required");
    if (draft.start && !/^\d{4}-\d{2}-\d{2}$/.test(draft.start)) return fail("Dates are entered as YYYY-MM-DD");
    const existing = draft.id ? roster.find((p) => p.id === draft.id) : null;
    upsertStaff({
      id: draft.id ?? `st${roster.length + 1}-${Date.now().toString(36)}`,
      identityKey: draft.identityKey, active: existing ? existing.active : true,
      name: draft.name.trim(), position: draft.position.trim(), type: draft.type, start: draft.start,
      end: existing?.end ?? null, payBasis: draft.payBasis, rate, hours: parseFloat(draft.hours) || 0,
      superPct: parseFloat(draft.superPct) || 0, award: draft.award.trim(), email: draft.email.trim(),
      phone: draft.phone.trim(), abn: draft.abn.trim(),
      contract: { type: draft.contractType, ref: draft.contractRef.trim(), status: draft.contractStatus,
        signed: draft.contractSigned, expires: draft.contractExpires.trim() || "Ongoing" },
      notes: draft.notes.trim(),
    });
    say(draft.id ? `${draft.name}'s record updated` : `${draft.name} added to the roster`);
    setError(null);
    setDraft(null);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s5 }} keyboardShouldPersistTaps="handled">
      <View>
        <Eyebrow>Studio staff</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8 }}>
          Everyone the studio engages — position, pay rate, superannuation and the contract behind each engagement. Records for people who have left are retained, not deleted.
        </Body>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {kpis.map(([label, value, hint]) => (
          <Card key={label} style={{ padding: 18, flexGrow: 1, flexBasis: 180 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.6, fontSize: 9.5, color: theme.ink.tertiary }}>{label}</Text>
            <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 27, color: theme.ink.primary, marginTop: 8, marginBottom: 3 }}>{value}</Text>
            <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 13, lineHeight: 18, color: theme.ink.tertiary }}>{hint}</Text>
          </Card>
        ))}
      </View>

      <SegBar>
        <Seg label="Roster" count={roster.length} on={tab === "roster"} onPress={() => setTab("roster")} />
        <Seg label="Contracts" count={roster.length} on={tab === "contracts"} onPress={() => setTab("contracts")} />
      </SegBar>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <TextInput
          value={query} onChangeText={setQuery} placeholder="Search name, role or contract…" placeholderTextColor={theme.ink.tertiary}
          style={{ flexGrow: 1, flexBasis: 220, minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default,
            borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }}
        />
        <Button label="Add staff member" onPress={() => { setTab("roster"); setError(null); setDraft(emptyDraft(roster.length + 1)); }} />
      </View>

      {flash ? <Note>{flash}</Note> : null}

      {draft ? (
        <Card gold style={{ padding: 18, gap: 16 }}>
          <Eyebrow>{draft.id ? "Edit employment record" : "New staff member"}</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field label="Full name · required" value={draft.name} onChange={(t) => setDraft({ ...draft, name: t })} placeholder="e.g. Priya Raman" />
            <Field label="Hired position / role · required" value={draft.position} onChange={(t) => setDraft({ ...draft, position: t })} placeholder="e.g. Second Photographer" />
          </View>
          <ChipRow label="Engagement type" options={ENGAGEMENT_TYPES} value={draft.type} onChange={(v) => setDraft({ ...draft, type: v as EngagementType })} />
          <ChipRow label="Pay basis" options={PAY_BASES} value={draft.payBasis} onChange={(v) => setDraft({ ...draft, payBasis: v as PayBasis })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field numeric label={draft.payBasis === "Salary" ? "Annual salary $" : draft.payBasis === "Day rate" ? "Day rate $" : "Hourly rate $"}
              value={draft.rate} onChange={(t) => setDraft({ ...draft, rate: t })} placeholder="0.00" />
            {draft.payBasis === "Hourly" ? (
              <Field numeric label="Rostered hours per week" value={draft.hours} onChange={(t) => setDraft({ ...draft, hours: t })} placeholder="38" />
            ) : null}
            <Field numeric label="Superannuation %" value={draft.superPct} onChange={(t) => setDraft({ ...draft, superPct: t })} placeholder="12" />
            <Field label="Start date" value={draft.start} onChange={(t) => setDraft({ ...draft, start: t })} placeholder="YYYY-MM-DD" />
            <Field label="Award / classification" value={draft.award} onChange={(t) => setDraft({ ...draft, award: t })} placeholder="e.g. Clerks — Private Sector Award · Level 3" />
            <Field label="Email" value={draft.email} onChange={(t) => setDraft({ ...draft, email: t })} placeholder="name@illuminatestudios.com.au" />
            <Field label="Phone" value={draft.phone} onChange={(t) => setDraft({ ...draft, phone: t })} placeholder="+61 4…" />
            {draft.type === "Contractor" ? (
              <Field numeric label="Contractor ABN" value={draft.abn} onChange={(t) => setDraft({ ...draft, abn: t })} placeholder="11 digits" />
            ) : null}
          </View>
          <Note>
            {draft.type === "Contractor"
              ? "Contractors engaged principally for their labour still attract superannuation under s.12(3) of the SGAA."
              : "Casual loading and the superannuation guarantee are recorded against the rate you enter here."}
          </Note>

          <View style={{ height: 1, backgroundColor: theme.border.subtle }} />
          <Eyebrow>Contract</Eyebrow>
          <ChipRow label="Agreement type" options={CONTRACT_TYPES} value={draft.contractType} onChange={(v) => setDraft({ ...draft, contractType: v })} />
          <ChipRow label="Contract status" options={CONTRACT_STATUSES} value={draft.contractStatus} onChange={(v) => setDraft({ ...draft, contractStatus: v as ContractStatus })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <Field label="Contract reference" value={draft.contractRef} onChange={(t) => setDraft({ ...draft, contractRef: t })} placeholder="EMP-007" />
            <Field label="Signed" value={draft.contractSigned} onChange={(t) => setDraft({ ...draft, contractSigned: t })} placeholder="YYYY-MM-DD" />
            <Field label="Expires" value={draft.contractExpires} onChange={(t) => setDraft({ ...draft, contractExpires: t })} placeholder="Ongoing or YYYY-MM-DD" />
          </View>
          <Field multiline label="Notes" value={draft.notes} onChange={(t) => setDraft({ ...draft, notes: t })} placeholder="Rostering, approvals, anything the studio should remember" />
          {error ? (
            <Text accessibilityRole="alert" style={{ fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 18, color: theme.status.warning }}>{error}</Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Button label={draft.id ? "Save record" : "Add to roster"} onPress={save} />
            <Button label="Cancel" variant="ghost" onPress={() => { setError(null); setDraft(null); }} />
          </View>
        </Card>
      ) : null}

      {tab === "roster" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {shown.map((p) => (
            <Card key={p.id} style={{ padding: 18, flexGrow: 1, flexBasis: twoCol ? 340 : "100%", opacity: p.active ? 1 : 0.7 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border.default, backgroundColor: theme.surface.inset, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 13, color: theme.brand.gold }}>{initialsOf(p.name)}</Text>
                </View>
                <Badge label={p.active ? p.type : "Ended"} tone={!p.active ? "muted" : p.type === "Contractor" ? "gold" : p.type === "Casual" ? "warning" : "success"} />
              </View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: theme.ink.primary, marginTop: 14 }}>{p.name}</Text>
              <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 15, color: theme.brand.gold, marginTop: 2 }}>{p.position}</Text>
              {p.identityKey ? <View style={{ marginTop: 8, alignSelf: "flex-start" }}><Badge label="Named in Site Content" tone="gold" /></View> : null}

              <View style={{ gap: 9, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: theme.border.subtle }}>
                <Fact label="Employment" value={`${p.type}${p.start ? " · since " + fmtDay(p.start) : ""}`} />
                <Fact label="Pay rate" value={staffPayLabel(p) + (p.payBasis === "Hourly" && p.hours ? ` · ${p.hours} hrs/week` : "")} />
                <Fact label="Superannuation" value={`${p.superPct}% guarantee`} />
                <Fact label="Classification" value={p.award || "—"} />
                <Fact label="Contact" value={[p.email, p.phone].filter(Boolean).join(" · ") || "—"} />
                {p.abn ? <Fact label="ABN" value={p.abn} /> : null}
                {!p.active && p.end ? <Fact label="Engagement ended" value={fmtDay(p.end)} /> : null}
              </View>

              <View style={{ gap: 6, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: theme.border.subtle }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Mono size={11} color={theme.ink.secondary}>{p.contract.ref} · {p.contract.type}</Mono>
                  <Badge label={p.contract.status} tone={contractTone(p.contract.status)} />
                </View>
                <Mono size={10}>
                  {(p.contract.signed ? "signed " + fmtDay(p.contract.signed) : "unsigned")} · {p.contract.expires !== "Ongoing" ? "expires " + fmtDay(p.contract.expires) : "ongoing"}
                </Mono>
              </View>

              {p.notes ? <Note>{p.notes}</Note> : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <Button label="Edit record" variant="ghost" onPress={() => { setError(null); setDraft(draftOf(p)); }} />
                <Button label={p.active ? "End engagement" : "Reinstate"} variant="ghost"
                  onPress={() => { toggleStaffActive(p.id); say(p.active ? `${p.name}'s engagement ended — record retained` : `${p.name} reinstated on the roster`); }} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((p) => (
            <Card key={p.id} style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexGrow: 1, flexBasis: 180, gap: 3 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13.5, color: theme.ink.primary }}>{p.name}</Text>
                  <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 14, color: theme.ink.secondary }}>{p.position}</Text>
                </View>
                <Badge label={p.contract.status} tone={contractTone(p.contract.status)} />
              </View>
              <View style={{ gap: 3 }}>
                <Mono size={11} color={theme.brand.gold}>{p.contract.ref} · {p.contract.type}</Mono>
                <Mono size={10}>
                  {(p.contract.signed ? "Signed " + fmtDay(p.contract.signed) : "Not yet signed")} · {p.contract.expires !== "Ongoing" ? "Expires " + fmtDay(p.contract.expires) : "Ongoing, no end date"}
                </Mono>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderColor: theme.border.subtle, paddingTop: 10 }}>
                {p.contract.status === "Awaiting signature" || p.contract.status === "Draft" ? (
                  <Button label="Send for signature" onPress={() => say(`${p.contract.type} sent to ${p.name} for signature`)} />
                ) : null}
                {p.contract.status === "Expiring" ? (
                  <Button label="Prepare renewal" onPress={() => say(`Renewal of ${p.contract.ref} drafted for ${p.name}`)} />
                ) : null}
                {/* Only a contract needing action carries a filled button. */}
                <Button label="Open document" variant="ghost" onPress={() => say(`${p.contract.ref} · ${p.contract.type} — filed under Documents`)} />
              </View>
            </Card>
          ))}
        </View>
      )}

      {shown.length === 0 ? (
        <View style={{ padding: 40, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border.default, borderRadius: radius.sm }}>
          <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.ink.secondary }}>No matching staff records</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
