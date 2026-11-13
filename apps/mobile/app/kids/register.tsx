/**
 * Parent / guardian registration.
 *
 *  1. Linking code — ties the registration to one organisation.
 *  2. Register and give consent — guardian details, then each child: their
 *     class, group or team (listed with its primary staff member), name, year
 *     level and five consent options, every one of which starts off.
 *  3. On save, any OTHER group at the same organisation that lists the same
 *     first and last name is offered for linking. Nothing is linked without
 *     the parent's permission.
 *  4. Account — each child's permanent unique number, their groups, siblings
 *     and consent. The number is what links the account to galleries later.
 */
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "~/hooks/useResponsive";
import { useKids } from "~/state/kids";
import {
  K, TIERS, EMAIL_RE, blankDraftChild, findGroupMatches, guardianKidsAt, siblingsOf, consentSummary,
  groupLabel, fullName, type DraftChild, type GroupMatch,
} from "~/data/kids";
import {
  KF, KidsHeader, KEyebrow, KLabel, KTitle, KBody, KButton, KShadowCard, KCard, KField, KAlert,
  KTagPill, KSwitchRow, KCheckRow, KSelect, KSheet,
} from "~/components/kids/parts";

type Step = "code" | "form" | "account";

export default function KidsRegister() {
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const { db, register } = useKids();
  const scroller = React.useRef<ScrollView>(null);
  const top = () => scroller.current?.scrollTo({ y: 0, animated: false });

  const [step, setStep] = React.useState<Step>("code");
  const [code, setCode] = React.useState("");
  const [codeErr, setCodeErr] = React.useState("");
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [guardianId, setGuardianId] = React.useState<string | null>(null);
  const [g, setG] = React.useState({ name: "", email: "", phone: "" });
  const [g2On, setG2On] = React.useState(false);
  const [g2, setG2] = React.useState({ name: "", email: "" });
  const [kids, setKids] = React.useState<DraftChild[]>([blankDraftChild()]);
  // Off by default, like every consent option: siblings are linked only when the parent chooses it.
  const [linkSiblings, setLinkSiblings] = React.useState(false);
  const [attest, setAttest] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [matches, setMatches] = React.useState<GroupMatch[] | null>(null);
  const [picks, setPicks] = React.useState<Record<string, boolean>>({});

  const org = orgId ? db.orgs.find((o) => o.id === orgId) ?? null : null;
  const guardian = guardianId ? db.guardians.find((x) => x.id === guardianId) ?? null : null;
  const pad = Math.round(Math.max(16, Math.min(28, width * 0.04)));
  const h1 = Math.round(Math.max(32, Math.min(44, width * 0.05)));
  const wide = width >= 520;
  const half = { flexBasis: wide ? "47%" : "100%", flexGrow: 1 } as const;

  const existing = org ? guardianKidsAt(db, guardianId, org.id) : [];
  const showSiblingLink = existing.length + kids.length > 1;
  const siblingOK = showSiblingLink && linkSiblings;
  const tiers = TIERS.filter((t) => t.k !== "sibling" || siblingOK);

  const setKid = (i: number, patch: Partial<DraftChild>) => { setKids((list) => list.map((k, j) => (j === i ? { ...k, ...patch } : k))); setErr(""); };

  const submitCode = () => {
    const c = code.trim().toUpperCase();
    const found = db.orgs.find((o) => o.code === c);
    if (!found) return setCodeErr("That code doesn't match an open registration. Check the code from your organisation and try again.");
    setOrgId(found.id); setStep("form"); setCodeErr(""); setKids([blankDraftChild()]); setAttest(false); setErr(""); top();
  };
  const changeCode = () => { setStep("code"); setCode(""); setOrgId(null); setErr(""); top(); };

  const commit = (picked: GroupMatch[]) => {
    if (!org) return;
    const id = register({ orgId: org.id, guardianId, guardian: g, second: g2On ? { ...g2 } : null, kids, linkSiblings, picked });
    setGuardianId(id); setMatches(null); setPicks({}); setStep("account"); top();
  };

  const save = () => {
    if (!org) return;
    if (!guardianId && (!g.name.trim() || !EMAIL_RE.test(g.email))) return setErr("Add your full name and a valid email.");
    if (!guardianId && g2On && !g2.name.trim()) return setErr("Add the second guardian's name, or remove them.");
    if (kids.some((k) => !k.groupId)) return setErr("Choose a class, group or team for each child.");
    if (kids.some((k) => !k.first.trim() || !k.last.trim())) return setErr("Add a first and last name for each child.");
    if (!attest) return setErr("Confirm you are the parent, guardian or caregiver of each child.");
    // Matching stays inside the organisation the linking code belongs to.
    const found = findGroupMatches(db, org.id, kids);
    if (found.length) { setMatches(found); setPicks({}); setErr(""); return; }
    commit([]);
  };

  const groupOptions = org ? db.groups.filter((x) => x.orgId === org.id).map((x) => ({ value: x.id, label: groupLabel(x) })) : [];
  const siblingNames = [
    ...existing.map((c) => `${fullName(c)} (${c.uid})`),
    ...kids.map((k, i) => (k.first.trim() ? fullName(k) : `Child ${i + 1}`)),
  ].join(" · ");
  const myKids = guardianId ? db.children.filter((c) => c.guardianId === guardianId) : [];
  const anyPicked = (matches ?? []).some((m) => picks[m.key]);

  return (
    <View style={{ flex: 1, backgroundColor: K.ground }}>
      <KidsHeader>
        <Text numberOfLines={1} style={{ fontFamily: KF.semi, fontSize: 12, color: K.champagne }}>Parent registration</Text>
      </KidsHeader>
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: pad, paddingTop: Math.max(20, pad * 1.4), paddingBottom: insets.bottom + 64, gap: 18 }}>

        {step === "code" ? (
          <KShadowCard accent={K.gold} style={{ padding: Math.max(22, pad * 1.3), gap: 14 }}>
            <Text accessibilityRole="header" style={{ fontFamily: KF.display, fontSize: h1, lineHeight: h1, color: K.ink }}>Enter your linking code</Text>
            <KBody>Your centre, school or club sends this code when registrations open. It links your registration to that organisation.</KBody>
            <KField label="Linking code" mono value={code} onChangeText={(t) => { setCode(t.toUpperCase()); setCodeErr(""); }} placeholder="ILK-0000" autoCapitalize="characters" onSubmit={submitCode} />
            {codeErr ? <KAlert>{codeErr}</KAlert> : null}
            <KButton label="Continue" full height={52} onPress={submitCode} />
            <Text style={{ fontFamily: KF.mono, fontSize: 11.5, color: K.faint }}>Demo codes: ILK-7305 · ILK-2190 · ILK-4821</Text>
          </KShadowCard>
        ) : null}

        {step === "form" && org ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: K.greenTint, borderWidth: 1.5, borderColor: K.green }}>
              <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                <KLabel color={K.greenLink}>{org.type} · {org.code}</KLabel>
                <Text style={{ fontFamily: KF.display, fontSize: 22, lineHeight: 24, color: K.ink }}>{org.name}</Text>
              </View>
              <KButton label="Change code" variant="outline" height={44} onPress={changeCode} />
            </View>
            <Text accessibilityRole="header" style={{ fontFamily: KF.display, fontSize: h1, lineHeight: h1, color: K.ink }}>Register and give consent</Text>

            {guardian ? (
              <KCard>
                <KLabel>Registering as</KLabel>
                <Text style={{ fontFamily: KF.display, fontSize: 24, color: K.ink }}>{guardian.name}</Text>
                <Text style={{ fontFamily: KF.mono, fontSize: 12, color: K.muted }}>{guardian.email}</Text>
              </KCard>
            ) : (
              <KCard>
                <Text style={{ fontFamily: KF.display, fontSize: 24, color: K.ink }}>Parent, guardian or caregiver</Text>
                <KField label="Full name" value={g.name} onChangeText={(v) => { setG((s) => ({ ...s, name: v })); setErr(""); }} autoCapitalize="words" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  <KField style={half} label="Email" value={g.email} onChangeText={(v) => { setG((s) => ({ ...s, email: v })); setErr(""); }} keyboardType="email-address" autoCapitalize="none" />
                  <KField style={half} label="Mobile" value={g.phone} onChangeText={(v) => setG((s) => ({ ...s, phone: v }))} keyboardType="phone-pad" />
                </View>
                {g2On ? (
                  <View style={{ gap: 10, paddingTop: 12, borderTopWidth: 1.5, borderStyle: "dashed", borderTopColor: "rgba(22,19,14,0.16)" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ fontFamily: KF.bold, fontSize: 14, color: K.ink }}>Second guardian</Text>
                      <KButton label="Remove" variant="danger" height={44} accessibilityLabel="Remove second guardian" onPress={() => { setG2On(false); setG2({ name: "", email: "" }); }} />
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      <KField style={half} label="Full name" value={g2.name} onChangeText={(v) => { setG2((s) => ({ ...s, name: v })); setErr(""); }} autoCapitalize="words" />
                      <KField style={half} label="Email" value={g2.email} onChangeText={(v) => setG2((s) => ({ ...s, email: v }))} keyboardType="email-address" autoCapitalize="none" />
                    </View>
                  </View>
                ) : (
                  <KButton label="+ Add a second guardian" variant="dashed" height={44} onPress={() => setG2On(true)} />
                )}
              </KCard>
            )}

            {kids.map((k, i) => {
              const anyOn = tiers.some((t) => k.consent[t.k]);
              return (
                <KShadowCard key={i} accent={K.green} offset={5} radius={24} style={{ padding: Math.max(18, pad), gap: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: K.gold, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontFamily: KF.display, fontSize: 20, lineHeight: 24, color: K.ink }}>{i + 1}</Text>
                      </View>
                      <Text style={{ fontFamily: KF.display, fontSize: 24, color: K.ink }}>Child</Text>
                    </View>
                    {kids.length > 1 ? <KButton label="Remove" variant="danger" height={44} accessibilityLabel={`Remove child ${i + 1}`} onPress={() => setKids((list) => list.filter((_, j) => j !== i))} /> : null}
                  </View>
                  <KSelect label="Class, group or team" placeholder="Choose a class, group or team" value={k.groupId} options={groupOptions} onChange={(v) => setKid(i, { groupId: v })} />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    <KField style={half} label="First name" value={k.first} onChangeText={(v) => setKid(i, { first: v })} autoCapitalize="words" />
                    <KField style={half} label="Last name" value={k.last} onChangeText={(v) => setKid(i, { last: v })} autoCapitalize="words" />
                    <KField style={half} label="Year level or age group" value={k.year} onChangeText={(v) => setKid(i, { year: v })} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <KLabel>Consent</KLabel>
                    {tiers.map((t) => (
                      <KSwitchRow key={t.k} label={t.label} sub={t.sub} on={!!k.consent[t.k]} onToggle={() => setKid(i, { consent: { ...k.consent, [t.k]: !k.consent[t.k] } })} />
                    ))}
                    {!anyOn ? (
                      <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: K.errorBg }}>
                        <Text style={{ fontFamily: KF.body, fontSize: 13.5, lineHeight: 20, color: K.error }}>With no consent selected, this child will be excluded from all photos.</Text>
                      </View>
                    ) : null}
                  </View>
                </KShadowCard>
              );
            })}

            <KButton label="+ Add another child" variant="dashed" full height={52} style={{ borderRadius: 20 }} onPress={() => setKids((list) => [...list, blankDraftChild()])} />

            {showSiblingLink ? (
              <KCheckRow on={linkSiblings} onToggle={() => setLinkSiblings((v) => !v)} label="Link these children as siblings">
                <Text style={{ fontFamily: KF.semi, fontSize: 14.5, color: K.ink }}>Link these children as siblings</Text>
                <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19.5, color: K.greenLink }}>{siblingNames}</Text>
                <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19.5, color: K.muted }}>Siblings can be in different classes or teams. Each child keeps their own permanent unique number.</Text>
              </KCheckRow>
            ) : null}

            <KCheckRow on={attest} onToggle={() => { setAttest((v) => !v); setErr(""); }} label="I am the parent, legal guardian or caregiver of each child registered here">
              <Text style={{ fontFamily: KF.body, fontSize: 14.5, lineHeight: 21, color: K.ink }}>I am the parent, legal guardian or caregiver of each child registered here, and the consent above is my choice.</Text>
            </KCheckRow>
            {err ? <KAlert>{err}</KAlert> : null}
            <KButton label="Save registration" full height={56} onPress={save} />
          </>
        ) : null}

        {step === "account" ? (
          <>
            <View style={{ gap: 6 }}>
              <KEyebrow>Your account · {guardian?.name ?? ""}</KEyebrow>
              <Text accessibilityRole="header" style={{ fontFamily: KF.display, fontSize: h1, lineHeight: h1, color: K.ink }}>Your children</Text>
              <KBody size={14.5}>Each child has a unique number. It links your account to their galleries once the shoot is complete.</KBody>
            </View>
            {myKids.map((c) => {
              const groups = c.groupIds.map((id) => db.groups.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
              const sibs = siblingsOf(db, c);
              const consent = consentSummary(c.consent, !!c.famId);
              const ready = groups.some((x) => db.shoots[x.orgId]?.phase === 4);
              return (
                <KShadowCard key={c.id} accent={K.gold} offset={5} radius={24} style={{ padding: Math.max(18, pad) }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    <Text style={{ flex: 1, minWidth: 160, fontFamily: KF.display, fontSize: 26, lineHeight: 28, color: K.ink }}>{fullName(c)}</Text>
                    <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: K.goldTint, borderWidth: 1.5, borderColor: K.gold }}>
                      <Text selectable style={{ fontFamily: KF.mono, fontSize: 13, color: K.ink }}>{c.uid}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    {groups.map((x) => (
                      <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: K.green }} />
                        <Text style={{ flex: 1, fontFamily: KF.body, fontSize: 13.5, lineHeight: 19, color: K.ink }}>{db.orgs.find((o) => o.id === x.orgId)?.name} · {groupLabel(x)}</Text>
                      </View>
                    ))}
                  </View>
                  {sibs.length ? <Text style={{ fontFamily: KF.semi, fontSize: 13, lineHeight: 19.5, color: K.ink }}>Siblings: {sibs.map((x) => `${fullName(x)} (${x.uid})`).join(", ")}</Text> : null}
                  <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19.5, color: consent.excluded ? K.error : K.greenLink }}>{consent.text}</Text>
                  <KTagPill label={ready ? "Gallery ready to view" : "Gallery opens after the shoot"} bg={ready ? K.green : K.panel} />
                </KShadowCard>
              );
            })}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <KButton label="Register another child" onPress={() => { setStep("form"); setKids([blankDraftChild()]); setAttest(false); setErr(""); top(); }} />
              <KButton label="Enter another linking code" variant="outline" onPress={changeCode} />
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Cross-group match confirmation — nothing is linked without permission. */}
      <KSheet visible={!!matches && !!org} onClose={() => setMatches(null)} center dismissable={false} maxWidth={540}>
        <KTitle size={30}>Link to other groups?</KTitle>
        <KBody size={14.5}>We found these names in other classes, groups or teams at {org?.name}. Select each one that is your child to link them with the same consent choices. Nothing is linked without your permission.</KBody>
        {(matches ?? []).map((m) => {
          const k = kids[m.childIndex];
          const grp = db.groups.find((x) => x.id === m.groupId);
          if (!k || !grp) return null;
          const on = !!picks[m.key];
          return (
            <KCheckRow key={m.key} on={on} highlight onToggle={() => setPicks((p) => ({ ...p, [m.key]: !p[m.key] }))} label={`${fullName(k)} — ${grp.name}`}>
              <Text style={{ fontFamily: KF.bold, fontSize: 15, color: K.ink }}>{fullName(k)}</Text>
              <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19, color: K.body }}>{org?.name} · {grp.name} · {grp.lead}</Text>
            </KCheckRow>
          );
        })}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <KButton label={anyPicked ? "Link selected and save" : "Save without linking"} height={52} style={{ flexGrow: 1, minWidth: 180 }} onPress={() => commit((matches ?? []).filter((m) => picks[m.key]))} />
          <KButton label="Go back" variant="text" height={52} onPress={() => { setMatches(null); setPicks({}); }} />
        </View>
      </KSheet>
    </View>
  );
}
