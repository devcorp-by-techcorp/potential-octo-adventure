/**
 * Luma — AI concierge drawer. Right half-sheet on wide, full-height slide
 * on compact (RN Modal handles the overlay + keyboard). Exposed app-wide via
 * useLuma().open().
 */
import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Icon } from "./Icon";
import { lumaReply, LUMA_OPENERS, LUMA_QUICKS } from "~/data/seed";
import { useSession } from "~/state/session";
import { useStudio, adminGreeting } from "~/state/studio";
import { INQUIRIES_FULL } from "~/data/seed";

interface Msg { who: "you" | "luma"; text: string; }
const LumaContext = createContext<{ open: () => void }>({ open: () => {} });
export const useLuma = () => useContext(LumaContext);

export const LumaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ open: () => setVisible(true) }), []);
  return (
    <LumaContext.Provider value={value}>
      {children}
      <LumaDrawer visible={visible} onClose={() => setVisible(false)} />
    </LumaContext.Provider>
  );
};

const LumaDrawer: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { theme, radius } = useTokens();
  const { isWide } = useResponsive();
  const insets = useSafeAreaInsets();
  const { authed, role } = useSession();
  const persona = !authed ? "public" : role === "admin" ? "admin" : "client";
  // Studio staff are greeted by the name held in Site Content, so a change
  // there is the name Luma uses on the next open.
  const { identity } = useStudio();
  const openerFor = (p: typeof persona) =>
    p === "admin" ? adminGreeting(identity, INQUIRIES_FULL.filter((q) => q.status === "new").length) : LUMA_OPENERS[p];
  const [input, setInput] = useState("");
  // Opener is persona-resolved (public visitor / client / studio) — the drawer
  // is mounted app-wide, so it re-seeds when the persona changes.
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "luma", text: openerFor(persona) }]);
  const lastPersona = useRef(persona);
  if (lastPersona.current !== persona) {
    lastPersona.current = persona;
    setMsgs([{ who: "luma", text: openerFor(persona) }]);
  }
  const scroll = useRef<ScrollView>(null);

  const send = (t?: string) => {
    const text = (t ?? input).trim();
    if (!text) return;
    setMsgs((m) => [...m, { who: "you", text }, { who: "luma", text: lumaReply(text, persona) }]);
    setInput("");
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  };

  return (
    <Modal visible={visible} transparent animationType={isWide ? "fade" : "slide"} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: theme.scrim, flexDirection: "row", justifyContent: "flex-end" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: isWide ? 440 : "100%" }}>
          <Pressable
            onPress={() => {}}
            style={{ flex: 1, backgroundColor: theme.surface.raised, borderLeftWidth: isWide ? 1 : 0, borderColor: theme.border.subtle, paddingTop: insets.top }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
              <Icon name="sparkle" size={20} color={theme.brand.gold} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: theme.ink.primary }}>Luma</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: theme.ink.tertiary }}>AI concierge</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={20} color={theme.ink.tertiary} />
              </Pressable>
            </View>

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {msgs.map((m, i) => {
                const me = m.who === "you";
                return (
                  <View key={i} style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                    <Text style={{
                      fontFamily: "Inter_400Regular", fontSize: 13.5, lineHeight: 20,
                      color: me ? theme.ink.inverse : theme.ink.primary,
                      backgroundColor: me ? theme.brand.gold : theme.surface.inset,
                      borderWidth: me ? 0 : 1, borderColor: theme.border.subtle,
                      paddingVertical: 11, paddingHorizontal: 14,
                      borderRadius: 12, borderBottomRightRadius: me ? 3 : 12, borderBottomLeftRadius: me ? 12 : 3,
                    }}>{m.text}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ padding: 14, paddingBottom: 14 + insets.bottom, borderTopWidth: 1, borderColor: theme.border.subtle, gap: 10 }}>
              {LUMA_QUICKS[persona].length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {LUMA_QUICKS[persona].map((q) => (
                  <Pressable key={q} onPress={() => send(q)} style={{ minHeight: 44, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 9999, borderWidth: 1, borderColor: theme.border.gold, backgroundColor: theme.brand.goldMuted }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.brand.gold }}>{q}</Text>
                  </Pressable>
                ))}
              </View>}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => send()}
                  placeholder="Message Luma…"
                  placeholderTextColor={theme.ink.tertiary}
                  style={{ flex: 1, minHeight: 46, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }}
                />
                <Pressable onPress={() => send()} style={{ width: 46, height: 46, borderRadius: radius.xs, backgroundColor: theme.brand.gold, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="arrow" size={18} color={theme.ink.inverse} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};
