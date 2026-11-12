/**
 * Illuminate Kids — public landing. Two clear paths: organisations enquire (or
 * chat with Luma), parents enter the code their organisation gave them.
 *
 * No pricing is shown anywhere. An enquiry is a tentative request: nothing is
 * booked or held until the studio confirms. Luma is chat only — no prompt
 * buttons on customer-facing surfaces.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, TextInput, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsive } from "~/hooks/useResponsive";
import { useKids } from "~/state/kids";
import {
  K, TIERS, ORG_TYPES, ENQUIRY_TYPES, REGISTRATION_STEPS, EMAIL_RE,
  KIDS_LUMA_OPENER, askKidsLuma, type LumaTurn,
} from "~/data/kids";
import {
  KF, KidsHeader, KidsTag, KEyebrow, KLabel, KTitle, KBody, KButton, KShadowCard, KField, KAlert, KChip,
  KTagPill, KSheet, KRoundClose, KImageSlot, KSpark,
} from "~/components/kids/parts";

const TILTS = ["-2deg", "1.5deg", "-1deg", "2deg", "-1.5deg", "1deg"];
const CHIP_BG = [K.card, K.greenTint, K.goldTint];
const STEP_OFFSET = [0, 22, 6, 30];

export default function KidsLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useResponsive();
  const [enquiryOpen, setEnquiryOpen] = React.useState(false);
  const [lumaOpen, setLumaOpen] = React.useState(false);

  const pad = Math.round(Math.max(16, Math.min(36, width * 0.04)));
  const two = width >= 760;
  const stepCols = width >= 1000 ? 4 : width >= 560 ? 2 : 1;
  const h1 = Math.round(Math.max(38, Math.min(66, width * 0.064)));
  const h2 = Math.round(Math.max(30, Math.min(42, width * 0.04)));
  const sectionGap = Math.round(Math.max(40, Math.min(72, width * 0.07)));
  const heroH = Math.round(Math.max(300, Math.min(440, width * (two ? 0.34 : 0.72))));

  const goRegister = () => router.push("/kids/register");

  return (
    <View style={{ flex: 1, backgroundColor: K.ground }}>
      <KidsHeader>
        <Pressable onPress={() => router.replace("/marketing")} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: KF.semi, fontSize: 12, letterSpacing: 0.5, color: K.champagne }}>Main site</Text>
        </Pressable>
        <Pressable onPress={goRegister} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 999, backgroundColor: K.gold }}>
          <Text numberOfLines={1} style={{ fontFamily: KF.bold, fontSize: 13, color: K.ink }}>I have a code</Text>
        </Pressable>
      </KidsHeader>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
        {/* Hero */}
        <View style={{ overflow: "hidden", paddingHorizontal: pad, paddingTop: Math.max(28, pad * 1.6), paddingBottom: Math.max(32, pad * 1.6) }}>
          <View style={{ position: "absolute", width: 340, height: 340, right: -90, top: -120, borderRadius: 170, backgroundColor: K.gold, opacity: 0.35 }} />
          <View style={{ position: "absolute", width: 220, height: 220, left: -80, bottom: -90, borderRadius: 110, backgroundColor: K.green, opacity: 0.3 }} />
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: two ? "row" : "column", alignItems: two ? "center" : "stretch", gap: two ? 48 : 28 }}>
            <View style={{ flex: two ? 1 : undefined, minWidth: 0, gap: 16 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <View style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: K.ink }}>
                  <Text style={{ fontFamily: KF.mono, fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: K.gold }}>Illuminate Kids</Text>
                </View>
                <Text style={{ fontFamily: KF.semi, fontSize: 12.5, color: K.body }}>Early learning, schools and clubs</Text>
              </View>
              <Text accessibilityRole="header" style={{ fontFamily: KF.display, fontSize: h1, lineHeight: h1, letterSpacing: -0.6, color: K.ink }}>
                School and club photos, <Text style={{ fontFamily: KF.displayItalic, color: K.greenLink }}>handled with care.</Text>
              </Text>
              <KBody size={width >= 900 ? 17 : 15} style={{ maxWidth: 520 }}>
                Illuminate Kids is the children's photography branch of Illuminate Studios. We photograph early childhood centres, kindergartens, schools and clubs, and only children whose parent or guardian has registered them and given consent.
              </KBody>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                <KButton label="I'm an organisation" height={50} onPress={() => setEnquiryOpen(true)} />
                <KButton label="I'm a parent with a code" variant="outline" height={50} onPress={goRegister} />
              </View>
            </View>
            <View style={{ flex: two ? 1 : undefined, minWidth: 0, height: heroH }}>
              <KImageSlot label="Approved hero image" bg={K.panelSoft}
                style={{ position: "absolute", left: 0, top: 0, width: "78%", height: "82%", borderRadius: 34, transform: [{ rotate: "-2deg" }] }} />
              <KImageSlot label="Approved image" bg={K.greenTint}
                style={{ position: "absolute", right: 0, bottom: 0, width: "46%", height: "48%", borderTopLeftRadius: 999, borderTopRightRadius: 999, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, transform: [{ rotate: "4deg" }] }} />
              <View style={{ position: "absolute", left: "62%", top: "6%", width: 22, height: 22, borderRadius: 11, backgroundColor: K.green }} />
              <View style={{ position: "absolute", left: -4, bottom: "12%", width: 14, height: 14, borderRadius: 7, backgroundColor: K.gold }} />
            </View>
          </View>
        </View>

        {/* Two paths */}
        <View style={{ paddingHorizontal: pad }}>
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: two ? "row" : "column", gap: 18 }}>
            <KShadowCard accent={K.green} tilt="-0.6deg" outer={{ flex: two ? 1 : undefined }} style={{ flexGrow: 1, padding: Math.max(22, pad) }}>
              <KTagPill label="For organisations" bg={K.green} />
              <KTitle size={Math.max(28, Math.min(36, width * 0.036))}>Book a photo day</KTitle>
              <KBody>Tell us about your centre, school or club, how many children and when suits. We'll review your request and, once it is confirmed, send your organisation's registration code for parents.</KBody>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 6 }}>
                <KButton label="Send an enquiry" onPress={() => setEnquiryOpen(true)} />
                <KButton label="Chat with Luma" variant="outline" icon={<KSpark />} onPress={() => setLumaOpen(true)} />
              </View>
              <KButton label="Already registered? Organisation sign in →" variant="text" height={44} onPress={() => router.push("/kids/org")} />
            </KShadowCard>
            <KShadowCard accent={K.gold} tilt="0.8deg" outer={{ flex: two ? 1 : undefined }} style={{ flexGrow: 1, padding: Math.max(22, pad) }}>
              <KTagPill label="For parents and guardians" bg={K.gold} />
              <KTitle size={Math.max(28, Math.min(36, width * 0.036))}>Register your child</KTitle>
              <KBody>Your organisation will let you know when registrations open and give you a code. Enter it to register your child or children and choose what you consent to.</KBody>
              <View style={{ paddingTop: 6 }}>
                <KButton label="I have a code →" variant="gold" onPress={goRegister} />
              </View>
            </KShadowCard>
          </View>
        </View>

        {/* Who we photograph */}
        <View style={{ paddingHorizontal: pad, paddingTop: sectionGap }}>
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center" }}>
            <KEyebrow>Who we photograph</KEyebrow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
              {ORG_TYPES.map((label, i) => (
                <View key={label} style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, backgroundColor: CHIP_BG[i % 3], borderWidth: 2, borderColor: K.ink, transform: [{ rotate: TILTS[i % 6] }] }}>
                  <Text style={{ fontFamily: KF.display, fontSize: Math.max(19, Math.min(24, width * 0.024)), color: K.ink }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* How registration works */}
        <View style={{ paddingHorizontal: pad, paddingTop: sectionGap }}>
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center" }}>
            <KEyebrow>How registration works</KEyebrow>
            <KTitle size={h2} style={{ marginTop: 6, marginBottom: 22, maxWidth: 520 }}>Consent comes first, before any photo is taken</KTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
              {REGISTRATION_STEPS.map((s, i) => (
                <View key={s.title} style={{ flexBasis: stepCols === 1 ? "100%" : stepCols === 2 ? "47%" : "22%", flexGrow: 1, marginTop: stepCols === 4 ? STEP_OFFSET[i] : 0, backgroundColor: K.card, borderWidth: 1.5, borderColor: K.line, borderRadius: 24, padding: 22, gap: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: i % 2 ? K.gold : K.green, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: KF.display, fontSize: 24, lineHeight: 28, color: K.ink }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontFamily: KF.display, fontSize: 23, lineHeight: 26, color: K.ink }}>{s.title}</Text>
                  <KBody size={14}>{s.body}</KBody>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Consent tiers */}
        <View style={{ paddingHorizontal: pad, paddingTop: sectionGap }}>
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", backgroundColor: K.ink, borderRadius: Math.max(24, Math.min(40, pad)), padding: Math.max(24, pad * 1.3), overflow: "hidden", flexDirection: two ? "row" : "column", gap: two ? 40 : 20 }}>
            <View style={{ position: "absolute", right: -60, bottom: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: K.green, opacity: 0.22 }} />
            <View style={{ flex: two ? 1 : undefined, gap: 12 }}>
              <KEyebrow color={K.gold}>Your consent choices</KEyebrow>
              <KTitle size={h2} color={K.ground}>You choose each one, for each child</KTitle>
              <KBody color="#e8e0d0">Every option starts switched off. A child who is not registered, or whose consent is declined, is excluded from all photos.</KBody>
            </View>
            <View style={{ flex: two ? 1 : undefined, gap: 10 }}>
              {TIERS.map((c, i) => (
                <View key={c.k} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: K.darkPanel }}>
                  <View style={{ width: 12, height: 12, marginTop: 5, borderRadius: 6, backgroundColor: i % 2 ? K.gold : K.green }} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={{ fontFamily: KF.semi, fontSize: 15, color: K.ground }}>{c.label}</Text>
                    <Text style={{ fontFamily: KF.body, fontSize: 13, lineHeight: 19.5, color: "#cfc6b4" }}>{c.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={{ marginTop: sectionGap, borderTopWidth: 1.5, borderTopColor: "rgba(22,19,14,0.12)", paddingHorizontal: pad, paddingVertical: Math.max(22, pad) }}>
          <View style={{ width: "100%", maxWidth: 1180, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <View style={{ gap: 6, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: KF.wordmark, fontSize: 12, letterSpacing: 2.2, color: K.ink }}>ILLUMINATE STUDIOS</Text>
                <KidsTag small />
              </View>
              <Text style={{ fontFamily: KF.mono, fontSize: 11, color: K.faint }}>studio@illuminatestudios.com.au</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <KButton label="Organisation enquiry" height={44} onPress={() => setEnquiryOpen(true)} />
              <KButton label="I have a code" variant="gold" height={44} onPress={goRegister} />
              <KButton label="Illuminate Studios →" variant="text" height={44} onPress={() => router.replace("/marketing")} />
            </View>
          </View>
        </View>
      </ScrollView>

      <EnquirySheet visible={enquiryOpen} onClose={() => setEnquiryOpen(false)} wide={width >= 520} />
      <LumaSheet visible={lumaOpen} onClose={() => setLumaOpen(false)} />
    </View>
  );
}

const BLANK = { org: "", type: "", count: "", dates: "", name: "", email: "" };

function EnquirySheet({ visible, onClose, wide }: { visible: boolean; onClose: () => void; wide: boolean }) {
  const { submitEnquiry } = useKids();
  const [f, setF] = React.useState(BLANK);
  const [err, setErr] = React.useState("");
  const [sent, setSent] = React.useState<typeof BLANK | null>(null);
  const set = (k: keyof typeof BLANK) => (v: string) => { setF((s) => ({ ...s, [k]: v })); setErr(""); };
  const close = () => { onClose(); setErr(""); if (sent) { setSent(null); setF(BLANK); } };
  const send = () => {
    if (!f.org.trim() || !f.name.trim() || !EMAIL_RE.test(f.email)) return setErr("Add your organisation, your name and a valid email.");
    submitEnquiry(f);
    setSent(f);
  };
  const half = { flexBasis: wide ? "47%" : "100%", flexGrow: 1 } as const;

  return (
    <KSheet visible={visible} onClose={close} title="Book a photo day">
      {sent ? (
        <View style={{ gap: 12, paddingVertical: 8 }}>
          <KTagPill label="Enquiry sent" bg={K.green} />
          <KBody>
            Thanks, {sent.name.trim()}. Your tentative request for {sent.org.trim()} has been received for studio review. The Illuminate Kids team will reply to {sent.email.trim()} with the next step — nothing is booked or held until the studio confirms it with you.
          </KBody>
          <KButton label="Close" full onPress={close} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <KField label="Organisation name" value={f.org} onChangeText={set("org")} autoCapitalize="words" />
          <View style={{ gap: 6 }}>
            <KLabel>Type</KLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ENQUIRY_TYPES.map((t) => <KChip key={t} label={t} on={f.type === t} onPress={() => set("type")(t)} />)}
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <KField style={half} label="Approx. number of children" value={f.count} onChangeText={set("count")} keyboardType="number-pad" />
            <KField style={half} label="Preferred dates" value={f.dates} onChangeText={set("dates")} placeholder="e.g. Term 2, Tuesdays" />
            <KField style={half} label="Your name" value={f.name} onChangeText={set("name")} autoCapitalize="words" />
            <KField style={half} label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
          </View>
          {err ? <KAlert>{err}</KAlert> : null}
          <KButton label="Send enquiry" full height={52} onPress={send} />
        </View>
      )}
    </KSheet>
  );
}

function LumaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = React.useState<LumaTurn[]>([{ from: "luma", text: KIDS_LUMA_OPENER }]);
  const [draft, setDraft] = React.useState("");
  const [waiting, setWaiting] = React.useState(false);
  const scroller = React.useRef<ScrollView>(null);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    const history: LumaTurn[] = [...msgs, { from: "me", text }];
    setMsgs(history);
    setDraft("");
    setWaiting(true);
    const out = await askKidsLuma(history, text);
    if (!alive.current) return;
    setMsgs((m) => [...m, { from: "luma", text: out }]);
    setWaiting(false);
  };

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: K.dark, borderBottomWidth: 3, borderBottomColor: K.green }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: K.gold, alignItems: "center", justifyContent: "center" }}><KSpark size={16} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: KF.bold, fontSize: 15, color: K.cream }}>Luma</Text>
        <Text style={{ fontFamily: KF.body, fontSize: 12, color: K.champagne }}>Illuminate Kids assistant</Text>
      </View>
      <KRoundClose dark onPress={onClose} />
    </View>
  );

  const shown: (LumaTurn & { pending?: boolean })[] = waiting ? [...msgs, { from: "luma", text: "· · ·", pending: true }] : msgs;

  return (
    <KSheet visible={visible} onClose={onClose} maxWidth={560} header={header} fill scroll={false}>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {shown.map((m, i) => {
          const me = m.from === "me";
          return (
            <View key={i} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "84%", paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18, backgroundColor: me ? K.ink : K.card, borderWidth: 1.5, borderColor: me ? K.ink : K.line }}>
              <Text accessibilityLabel={m.pending ? "Luma is typing" : undefined} style={{ fontFamily: KF.body, fontSize: 14.5, lineHeight: 21.75, color: me ? K.ground : K.ink }}>{m.text}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1.5, borderTopColor: "rgba(22,19,14,0.1)", backgroundColor: K.card }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Type a message" placeholderTextColor="#a39a88" accessibilityLabel="Message Luma"
          onSubmitEditing={send} returnKeyType="send" blurOnSubmit={false}
          style={[{ flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: K.lineStrong, borderRadius: 999, backgroundColor: K.white, fontFamily: KF.body, fontSize: 15, color: K.ink }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
        <KButton label="Send" onPress={send} />
      </View>
    </KSheet>
  );
}
