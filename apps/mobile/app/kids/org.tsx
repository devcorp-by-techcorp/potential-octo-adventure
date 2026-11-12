/**
 * Organisation dashboard — where a centre, school or club's manager works with
 * Illuminate Kids once registered.
 *
 * Overview (linking code, counts, next shoot) · Classes, groups and teams (each
 * linked to the organisation by its code, with staff and a student roster) ·
 * Shoot tracker · Inbox · Docs.
 *
 * The organisation lists student names so registrations can be matched, but the
 * studio sees a child's name only after their guardian completes registration.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useResponsive } from "~/hooks/useResponsive";
import { useKids } from "~/state/kids";
import {
  K, KIDS_PHASES, STAFF_ROLES, GROUP_KINDS, KIND_BG, registeredCount, orgStats, fullName,
  type GroupKind, type KidsGroup, type KidsOrg,
} from "~/data/kids";
import {
  KF, KidsHeader, KEyebrow, KLabel, KTitle, KBody, KButton, KShadowCard, KCard, KField, KInput, KAlert,
  KChip, KTagPill, KSelect,
} from "~/components/kids/parts";

type Tab = "overview" | "groups" | "tracker" | "inbox" | "docs";
const TABS: [Tab, string][] = [["overview", "Overview"], ["groups", "Classes, groups and teams"], ["tracker", "Shoot tracker"], ["inbox", "Inbox"], ["docs", "Docs"]];
const roleOptions = STAFF_ROLES.map((r) => ({ value: r, label: r }));

export default function KidsOrgPortal() {
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const { db } = useKids();
  const [orgId, setOrgId] = React.useState(db.orgs[0].id);
  const [tab, setTab] = React.useState<Tab>("overview");

  const org = db.orgs.find((o) => o.id === orgId) ?? db.orgs[0];
  const unread = (db.inbox[org.id] ?? []).filter((m) => !m.read).length;
  const pad = Math.round(Math.max(16, Math.min(28, width * 0.04)));
  const two = width >= 760;

  return (
    <View style={{ flex: 1, backgroundColor: K.ground }}>
      <KidsHeader>
        <Text numberOfLines={1} style={{ fontFamily: KF.semi, fontSize: 12, color: K.champagne }}>Organisation dashboard</Text>
      </KidsHeader>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: pad, paddingTop: Math.max(20, pad * 1.3), paddingBottom: insets.bottom + 64, gap: 18 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
          <View style={{ flex: 1, minWidth: 240, gap: 6 }}>
            <KEyebrow>{org.type} · Organisation dashboard</KEyebrow>
            <Text accessibilityRole="header" style={{ fontFamily: KF.display, fontSize: Math.max(30, Math.min(44, width * 0.046)), lineHeight: Math.max(30, Math.min(44, width * 0.046)), color: K.ink }}>{org.name}</Text>
            <Text style={{ fontFamily: KF.body, fontSize: 13.5, color: K.body }}>Signed in as {org.manager}, {org.managerRole}</Text>
          </View>
          <View style={{ minWidth: 220, flexGrow: two ? 0 : 1 }}>
            <KSelect label="Demo: view as" value={org.id} options={db.orgs.map((o) => ({ value: o.id, label: o.name }))} onChange={(v) => setOrgId(v)} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
          {TABS.map(([k, label]) => (
            <KChip key={k} strong label={label} on={tab === k} offColor={K.card} badge={k === "inbox" ? unread : 0} onPress={() => setTab(k)} />
          ))}
        </ScrollView>

        {tab === "overview" ? <Overview org={org} two={two} pad={pad} /> : null}
        {tab === "groups" ? <Groups key={org.id} org={org} two={two} pad={pad} /> : null}
        {tab === "tracker" ? <Tracker org={org} pad={pad} /> : null}
        {tab === "inbox" ? <Inbox key={org.id} org={org} two={two} pad={pad} /> : null}
        {tab === "docs" ? <Docs org={org} /> : null}
      </ScrollView>
    </View>
  );
}

interface P { org: KidsOrg; two?: boolean; pad: number; }

function Overview({ org, two, pad }: P) {
  const { db } = useKids();
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const st = orgStats(db, org.id);
  const shoot = db.shoots[org.id];
  const copy = async () => {
    try { await Clipboard.setStringAsync(org.code); } catch { /* the code stays visible to copy by hand */ }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return (
    <View style={{ flexDirection: two ? "row" : "column", gap: 18, alignItems: "flex-start" }}>
      <KShadowCard accent={K.gold} radius={26} outer={{ flex: two ? 1 : undefined, alignSelf: "stretch" }} style={{ padding: Math.max(20, pad) }}>
        <KEyebrow>Linking code</KEyebrow>
        <Text selectable style={{ fontFamily: KF.monoMedium, fontSize: Math.max(34, Math.min(46, pad * 1.9)), letterSpacing: 3, color: K.ink }}>{org.code}</Text>
        <KBody size={14.5}>Every class, group and team you create is linked to {org.name} by this code. Share it with parents when registrations open.</KBody>
        <KButton label={copied ? "Copied" : "Copy code"} height={46} onPress={copy} />
      </KShadowCard>
      <View style={{ flex: two ? 1 : undefined, alignSelf: "stretch", gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flexBasis: 150, flexGrow: 1, backgroundColor: K.card, borderWidth: 1.5, borderColor: K.line, borderRadius: 20, padding: 16, gap: 4 }}>
            <Text style={{ fontFamily: KF.display, fontSize: 36, lineHeight: 38, color: K.ink }}>{st.groups}</Text>
            <Text style={{ fontFamily: KF.body, fontSize: 13, color: K.body }}>Classes, groups and teams</Text>
          </View>
          <View style={{ flexBasis: 150, flexGrow: 1, backgroundColor: K.greenTint, borderWidth: 1.5, borderColor: K.green, borderRadius: 20, padding: 16, gap: 4 }}>
            <Text style={{ fontFamily: KF.display, fontSize: 36, lineHeight: 38, color: K.ink }}>{st.registered} <Text style={{ fontSize: 20, color: K.body }}>of {st.total}</Text></Text>
            <Text style={{ fontFamily: KF.body, fontSize: 13, color: K.body }}>Children registered</Text>
          </View>
        </View>
        {shoot ? (
          <View style={{ backgroundColor: K.card, borderWidth: 1.5, borderColor: K.line, borderRadius: 20, padding: 16, gap: 4 }}>
            <KLabel color={K.faint}>Next shoot</KLabel>
            <Text style={{ fontFamily: KF.display, fontSize: 24, lineHeight: 27, color: K.ink }}>{shoot.label}</Text>
            <Text style={{ fontFamily: KF.body, fontSize: 13.5, color: K.body }}>{shoot.date} · {KIDS_PHASES[shoot.phase]}</Text>
          </View>
        ) : null}
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: K.ink }}>
          <Text style={{ fontFamily: KF.body, fontSize: 13.5, lineHeight: 21, color: K.ground }}>Illuminate Studios sees a child's name only after their parent or guardian completes registration. Until then, studio staff see a count only.</Text>
        </View>
      </View>
    </View>
  );
}

function Groups({ org, two, pad }: P) {
  const { db, addGroup, addStaff, removeStaff, addStudent, removeStudent } = useKids();
  const groups = db.groups.filter((g) => g.orgId === org.id);
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [ng, setNg] = React.useState<{ name: string; lead: string; leadRole: string; kind: GroupKind } | null>(null);
  const [ngErr, setNgErr] = React.useState("");
  const [sf, setSf] = React.useState({ name: "", role: "Teacher" });
  const [rf, setRf] = React.useState({ first: "", last: "" });
  const [rfErr, setRfErr] = React.useState("");
  const grp: KidsGroup | null = groups.find((g) => g.id === groupId) ?? groups[0] ?? null;

  const saveNg = () => {
    if (!ng) return;
    if (!ng.name.trim() || !ng.lead.trim()) return setNgErr("Add a name and a primary staff member.");
    setGroupId(addGroup(org.id, ng));
    setNg(null); setNgErr("");
  };
  const saveStaff = () => {
    if (!grp || !sf.name.trim()) return;
    addStaff(grp.id, { name: sf.name.trim(), role: sf.role });
    setSf((s) => ({ name: "", role: s.role }));
  };
  const saveStudent = () => {
    if (!grp) return;
    if (!rf.first.trim() || !rf.last.trim()) return setRfErr("Add a first and last name.");
    addStudent(grp.id, rf.first, rf.last);
    setRf({ first: "", last: "" }); setRfErr("");
  };

  return (
    <View style={{ flexDirection: two ? "row" : "column", gap: 18, alignItems: "flex-start" }}>
      <View style={{ flex: two ? 1 : undefined, alignSelf: "stretch", gap: 10 }}>
        {ng ? (
          <KShadowCard accent={K.green} offset={5} radius={22} style={{ padding: 18 }}>
            <Text style={{ fontFamily: KF.display, fontSize: 24, color: K.ink }}>New class, group or team</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {GROUP_KINDS.map((k) => <KChip key={k} label={k} on={ng.kind === k} onPress={() => setNg({ ...ng, kind: k })} />)}
            </View>
            <KField label="Name" value={ng.name} onChangeText={(v) => { setNg({ ...ng, name: v }); setNgErr(""); }} placeholder="e.g. 4C, Under 11 Hawks, Senior Choir" />
            <KField label="Primary staff member" value={ng.lead} onChangeText={(v) => { setNg({ ...ng, lead: v }); setNgErr(""); }} placeholder="Full name" autoCapitalize="words" />
            <KSelect label="Role" value={ng.leadRole} options={roleOptions} onChange={(v) => setNg({ ...ng, leadRole: v })} />
            {ngErr ? <KAlert>{ngErr}</KAlert> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <KButton label={`Create and link to ${org.code}`} height={46} onPress={saveNg} />
              <KButton label="Cancel" variant="text" height={46} onPress={() => { setNg(null); setNgErr(""); }} />
            </View>
          </KShadowCard>
        ) : (
          <KButton label="+ New class, group or team" variant="dashed" full height={52} style={{ borderRadius: 20 }} onPress={() => setNg({ name: "", lead: "", leadRole: "Teacher", kind: "Class" })} />
        )}
        {groups.map((g) => {
          const on = !!grp && grp.id === g.id;
          return (
            <Pressable key={g.id} onPress={() => { setGroupId(g.id); setRfErr(""); }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: on ? K.ink : K.line, backgroundColor: on ? K.greenTint : K.card }}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: KF.display, fontSize: 22, lineHeight: 25, color: K.ink }}>{g.name}</Text>
                  <View style={{ paddingVertical: 2, paddingHorizontal: 9, borderRadius: 999, backgroundColor: on ? K.card : KIND_BG[g.kind] }}>
                    <Text style={{ fontFamily: KF.bold, fontSize: 11.5, color: K.ink }}>{g.kind}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: KF.body, fontSize: 13, color: K.body }}>{g.lead} · {g.leadRole}</Text>
              </View>
              <Text style={{ fontFamily: KF.semi, fontSize: 12.5, color: K.greenLink, textAlign: "right" }}>{registeredCount(g)} of {g.roster.length} registered</Text>
            </Pressable>
          );
        })}
      </View>

      {grp ? (
        <KCard strong style={{ flex: two ? 1 : undefined, alignSelf: "stretch", padding: Math.max(18, pad), gap: 18 }}>
          <View style={{ gap: 4 }}>
            <KEyebrow>{grp.kind} · linked to {org.code}</KEyebrow>
            <Text style={{ fontFamily: KF.display, fontSize: 32, lineHeight: 34, color: K.ink }}>{grp.name}</Text>
          </View>

          <View style={{ gap: 8 }}>
            <KLabel>Staff</KLabel>
            {[{ name: grp.lead, role: grp.leadRole, primary: true }, ...grp.staff.map((s) => ({ ...s, primary: false }))].map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: K.ground }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: KF.semi, fontSize: 14.5, color: K.ink }}>{s.name}</Text>
                  <Text style={{ fontFamily: KF.body, fontSize: 12.5, color: K.muted }}>{s.role}</Text>
                </View>
                {s.primary
                  ? <KTagPill label="Primary" bg={K.green} />
                  : <KButton label="Remove" variant="danger" height={44} accessibilityLabel={`Remove ${s.name}`} onPress={() => removeStaff(grp.id, i - 1)} />}
              </View>
            ))}
            <KInput value={sf.name} onChangeText={(v) => setSf((s) => ({ ...s, name: v }))} placeholder="Add faculty, coach or assistant" onSubmit={saveStaff} />
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <KSelect label="Role" value={sf.role} options={roleOptions} onChange={(v) => setSf((s) => ({ ...s, role: v }))} />
              </View>
              <KButton label="Add" height={50} accessibilityLabel="Add staff member" style={{ borderRadius: 12 }} onPress={saveStaff} />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <KLabel>Students</KLabel>
              <Text style={{ fontFamily: KF.body, fontSize: 12.5, color: K.muted }}>{registeredCount(grp)} of {grp.roster.length} registered</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <KInput style={{ flex: 1 }} value={rf.first} onChangeText={(v) => { setRf((s) => ({ ...s, first: v })); setRfErr(""); }} placeholder="First name" />
              <KInput style={{ flex: 1 }} value={rf.last} onChangeText={(v) => { setRf((s) => ({ ...s, last: v })); setRfErr(""); }} placeholder="Last name" onSubmit={saveStudent} />
              <KButton label="Add" height={44} accessibilityLabel="Add student" style={{ borderRadius: 12, paddingHorizontal: 14 }} onPress={saveStudent} />
            </View>
            {rfErr ? <KAlert>{rfErr}</KAlert> : null}
            {grp.roster.map((r) => {
              const c = r.childId ? db.children.find((x) => x.id === r.childId) : null;
              return (
                <View key={r.id} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 10, rowGap: 6, minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(22,19,14,0.1)" }}>
                  <Text style={{ flex: 1, minWidth: 120, fontFamily: KF.semi, fontSize: 14.5, color: K.ink }}>{fullName(r)}</Text>
                  {c ? <KTagPill mono label={c.uid} bg={K.goldTint} border={K.gold} /> : null}
                  {c?.famId ? <KTagPill label="Sibling linked" bg={K.greenTint} /> : null}
                  {!r.childId ? (
                    <>
                      <Text style={{ fontFamily: KF.semi, fontSize: 12, color: K.faint }}>Awaiting registration</Text>
                      <KButton label="Remove" variant="danger" height={44} accessibilityLabel={`Remove ${fullName(r)}`} onPress={() => removeStudent(grp.id, r.id)} />
                    </>
                  ) : null}
                </View>
              );
            })}
            <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 20, color: K.muted, marginTop: 2 }}>Parents register with your linking code. When their child's first and last name match a name here, the registration is linked to this {grp.kind.toLowerCase()}.</Text>
          </View>
        </KCard>
      ) : null}
    </View>
  );
}

function Tracker({ org, pad }: P) {
  const { db } = useKids();
  const shoot = db.shoots[org.id];
  const groups = db.groups.filter((g) => g.orgId === org.id);
  return (
    <View style={{ gap: 18 }}>
      {shoot ? (
        <KShadowCard accent={K.green} radius={24} style={{ padding: Math.max(18, pad), gap: 16 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: KF.display, fontSize: 28, lineHeight: 30, color: K.ink }}>{shoot.label}</Text>
            <Text style={{ fontFamily: KF.body, fontSize: 14, color: K.body }}>{shoot.date}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {KIDS_PHASES.map((label, i) => {
              const cur = i === shoot.phase, done = i < shoot.phase;
              return (
                <View key={label} accessibilityLabel={`${label}${cur ? ", current phase" : done ? ", complete" : ""}`}
                  style={{ flexBasis: 120, flexGrow: 1, gap: 8, padding: 12, borderRadius: 16, backgroundColor: cur ? K.goldTint : done ? K.greenTint : K.white, borderWidth: 1.5, borderColor: cur ? K.gold : "rgba(22,19,14,0.12)" }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: cur ? K.gold : done ? K.green : K.panel, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: KF.bold, fontSize: 13, color: K.ink }}>{done ? "✓" : i + 1}</Text>
                  </View>
                  <Text style={{ fontFamily: KF.semi, fontSize: 13.5, lineHeight: 17.5, color: K.ink }}>{label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={{ fontFamily: KF.body, fontSize: 13, color: K.muted }}>Illuminate Studios moves the shoot through each phase.</Text>
        </KShadowCard>
      ) : null}
      <View style={{ gap: 8 }}>
        <KEyebrow>Registration by group</KEyebrow>
        {groups.map((g) => {
          const n = g.roster.length, r = registeredCount(g);
          return (
            <View key={g.id} style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: K.card, borderWidth: 1.5, borderColor: "rgba(22,19,14,0.12)" }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ fontFamily: KF.semi, fontSize: 14.5, color: K.ink }}>{g.name} <Text style={{ fontFamily: KF.body, color: K.muted }}>· {g.lead}</Text></Text>
                <Text style={{ fontFamily: KF.semi, fontSize: 13, color: K.greenLink }}>{r} of {n} registered</Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: K.panel, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${n ? Math.round((r / n) * 100) : 0}%`, backgroundColor: K.green, borderRadius: 999 }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Inbox({ org, two, pad }: P) {
  const { db, markRead, reply } = useKids();
  const inbox = db.inbox[org.id] ?? [];
  const [msgId, setMsgId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const msg = inbox.find((m) => m.id === msgId) ?? null;
  const send = () => {
    const t = draft.trim();
    if (!t || !msg) return;
    reply(org.id, msg.id, t);
    setDraft("");
  };
  return (
    <View style={{ flexDirection: two ? "row" : "column", gap: 18, alignItems: "flex-start" }}>
      <View style={{ flex: two ? 1 : undefined, alignSelf: "stretch", gap: 8 }}>
        {inbox.map((m) => (
          <Pressable key={m.id} onPress={() => { setMsgId(m.id); if (!m.read) markRead(org.id, m.id); }} accessibilityRole="button" accessibilityLabel={`${m.subject}${m.read ? "" : ", unread"}`}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 2, borderColor: msgId === m.id ? K.ink : K.line, backgroundColor: K.card }}>
            <View style={{ width: 10, height: 10, marginTop: 6, borderRadius: 5, backgroundColor: m.read ? "transparent" : K.gold }} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ fontFamily: KF.bold, fontSize: 14.5, color: K.ink }}>{m.subject}</Text>
              <Text style={{ fontFamily: KF.body, fontSize: 12.5, color: K.muted }}>Illuminate Kids · {m.date}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {msg ? (
        <KCard strong style={{ flex: two ? 1 : undefined, alignSelf: "stretch", padding: Math.max(18, pad) }}>
          <Text style={{ fontFamily: KF.display, fontSize: 26, lineHeight: 29, color: K.ink }}>{msg.subject}</Text>
          <KBody color="#2f2a22">{msg.body}</KBody>
          {msg.thread.map((t, i) => (
            <View key={i} style={{ alignSelf: "flex-end", maxWidth: "88%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: K.ink }}>
              <Text style={{ fontFamily: KF.body, fontSize: 14, lineHeight: 21, color: K.ground }}>{t.text}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <KInput pill style={{ flex: 1 }} value={draft} onChangeText={setDraft} placeholder="Reply to Illuminate Kids" onSubmit={send} />
            <KButton label="Send" height={46} accessibilityLabel="Send reply" onPress={send} />
          </View>
        </KCard>
      ) : null}
    </View>
  );
}

function Docs({ org }: { org: KidsOrg }) {
  const { db, signDoc } = useKids();
  return (
    <View style={{ gap: 8, maxWidth: 760 }}>
      {(db.docs[org.id] ?? []).map((d) => (
        <View key={d.id} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: K.card, borderWidth: 1.5, borderColor: "rgba(22,19,14,0.12)" }}>
          <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
            <Text style={{ fontFamily: KF.bold, fontSize: 15, color: K.ink }}>{d.title}</Text>
            <Text style={{ fontFamily: KF.body, fontSize: 12.5, color: K.muted }}>{d.kind}</Text>
          </View>
          <KTagPill label={d.status} bg={d.status === "Signed" ? K.green : d.status === "To sign" ? K.gold : K.panel} />
          {d.status === "To sign" ? <KButton label="Review and sign" height={44} accessibilityLabel={`Review and sign ${d.title}`} onPress={() => signDoc(org.id, d.id)} /> : null}
        </View>
      ))}
    </View>
  );
}
