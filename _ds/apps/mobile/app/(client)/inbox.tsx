/**
 * Client inbox — correspondence from the studio, with in-portal e-signature.
 * Two-pane (list + reader) once measured width allows; on compact widths the
 * reader replaces the list and returns via "All messages". Signing files the
 * document into Documents and clears it from the inbox.
 */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { usePortal } from "~/state/portal";
import { dateShort, dateLabel, type InboxItem } from "~/data/seed";

const RELEASE_PARAS = (item: InboxItem) => [
  item.preview,
  "This release is entirely optional. By signing below, you grant Illuminate Studios a non-exclusive licence to feature select images from your collection in our portfolio, website and editorial submissions. No images will be sold or licensed to third parties without your express permission.",
  "You may revoke this consent at any time by written notice. Print delivery, gallery hosting and all primary services are unaffected by this decision.",
];
const QUESTIONNAIRE_PARAS = (item: InboxItem) => [
  item.preview,
  "Your answers become the run sheet and photographer brief for the day, so the moments that matter to you are the ones we plan around.",
];

export default function Inbox() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const router = useRouter();
  const { inbox, markRead, signItem } = usePortal();
  const [openId, setOpenId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [sigName, setSigName] = useState("");

  const twoPane = width >= 900;
  const open = inbox.find((i) => i.id === openId) ?? null;
  const showList = twoPane || !open;
  const showReader = twoPane || !!open;

  const openMsg = (id: string) => { setOpenId(id); setSigning(false); setSigName(""); markRead(id); };
  const close = () => { setOpenId(null); setSigning(false); setSigName(""); };
  const confirm = () => { if (open) { signItem(open.id); close(); } };

  const list = (
    <View style={{ flex: twoPane ? undefined : 1, width: twoPane ? 360 : "100%" }}>
      <Eyebrow>Correspondence</Eyebrow>
      <Display size={34} style={{ marginTop: 6 }}>Inbox</Display>
      <Body muted size={12.5} style={{ marginTop: 4, maxWidth: 460 }}>
        {inbox.length === 1 ? "1 message" : `${inbox.length} messages`} from the studio. Once signed, a document is filed in Documents.
      </Body>

      <View style={{ marginTop: 16, gap: 8 }}>
        {inbox.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => openMsg(m.id)}
            style={{
              minHeight: 44, flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.xs,
              backgroundColor: theme.surface.raised, borderWidth: 1,
              borderColor: openId === m.id ? theme.border.gold : theme.border.subtle,
            }}
          >
            <View style={{ width: 8, height: 8, marginTop: 5, borderRadius: 4, backgroundColor: m.read ? "transparent" : theme.brand.gold }} />
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: m.read ? theme.ink.secondary : theme.ink.primary }}>{m.title}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: theme.ink.tertiary }}>{m.from}</Text>
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: theme.ink.tertiary }}>{dateShort(m.sentAt)}</Text>
              </View>
              <Text numberOfLines={2} style={{ fontFamily: "Inter_400Regular", fontSize: fs(12), lineHeight: fs(12) * 1.45, color: theme.ink.secondary }}>{m.preview}</Text>
              {m.requiresSignature ? <Badge label="Signature required" tone="gold" /> : null}
            </View>
          </Pressable>
        ))}
        {inbox.length === 0 ? (
          <View style={{ padding: 36, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border.default, borderRadius: radius.sm }}>
            <Display size={19} style={{ color: theme.ink.secondary }}>Inbox empty</Display>
            <Body muted size={12.5} style={{ marginTop: 6 }}>Nothing waiting for you.</Body>
          </View>
        ) : null}
      </View>
    </View>
  );

  const reader = (
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
      {open ? (
        <>
          {!twoPane ? <Button label="All messages" icon="chevronL" variant="ghost" onPress={close} /> : null}
          <Card style={{ padding: fs(20) }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: theme.ink.tertiary }}>
              Sent by {open.from} · {dateLabel(open.sentAt)}
            </Text>
            <Display size={28} style={{ marginTop: 6, marginBottom: 10 }}>{open.title}</Display>
            {open.requiresSignature ? <Badge label={`Signature required · ${open.pages} pages`} tone="gold" /> : null}
            <View style={{ height: 1, backgroundColor: theme.border.subtle, marginVertical: 16 }} />

            {/* Document stock — cream paper, studio letterhead */}
            <View style={{ backgroundColor: "#f4ebd9", borderRadius: 2, padding: fs(22) }}>
              <View style={{ alignItems: "center", marginBottom: 18 }}>
                <Text style={{ fontFamily: "Cinzel_600SemiBold", textTransform: "uppercase", letterSpacing: 2.6, fontSize: 10.5, color: "#8a6f3e" }}>Illuminate Studios</Text>
                <View style={{ width: 36, height: 1, backgroundColor: "#8a6f3e", marginVertical: 10 }} />
                <Text style={{ fontFamily: "Cinzel_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: fs(13), color: "#1a1a1a", textAlign: "center" }}>{open.title}</Text>
              </View>
              {(open.requiresSignature ? RELEASE_PARAS(open) : QUESTIONNAIRE_PARAS(open)).map((p, i) => (
                <Text key={i} style={{ fontFamily: "CormorantGaramond_500Medium", fontSize: fs(15), lineHeight: fs(15) * 1.6, color: "#1a1a1a", marginBottom: 12 }}>{p}</Text>
              ))}
              {signing ? (
                <View style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#8a6f3e" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 2, fontSize: 10, color: "#8a6f3e", marginBottom: 8 }}>Sign your name below</Text>
                  <TextInput
                    value={sigName}
                    onChangeText={setSigName}
                    placeholder="Type your full name"
                    placeholderTextColor="rgba(26,26,26,0.4)"
                    style={{ minHeight: 46, borderBottomWidth: 1, borderColor: "#8a6f3e", fontFamily: "CormorantGaramond_500Medium", fontSize: 24, color: "#1a1a1a" }}
                  />
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
              {!signing ? <Button label="Download" icon="download" variant="ghost" /> : null}
              {open.requiresSignature && !signing ? <Button label="Begin signing" icon="edit" onPress={() => setSigning(true)} /> : null}
              {!open.requiresSignature ? <Button label="Open questionnaire" icon="clipboard" onPress={() => router.replace("/(client)/intake")} /> : null}
              {signing ? (
                <>
                  <Button label="Cancel" variant="ghost" onPress={() => { setSigning(false); setSigName(""); }} />
                  <View style={{ opacity: sigName.trim().length < 3 ? 0.45 : 1 }} pointerEvents={sigName.trim().length < 3 ? "none" : "auto"}>
                    <Button label="Confirm & sign" icon="check" onPress={confirm} />
                  </View>
                </>
              ) : null}
            </View>
          </Card>
        </>
      ) : (
        <View style={{ padding: 48, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border.default, borderRadius: radius.sm }}>
          <Text style={{ fontFamily: "CormorantGaramond_500Medium", fontStyle: "italic", fontSize: 18, color: theme.ink.tertiary }}>Select a message to view.</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s4 }}>
        <View style={{ flexDirection: twoPane ? "row" : "column", gap: twoPane ? 24 : 16, alignItems: "flex-start" }}>
          {showList ? list : null}
          {showReader ? reader : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
