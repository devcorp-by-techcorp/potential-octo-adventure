/**
 * IntakeScreen — the pre-shoot questionnaire stepper. Shared by the client
 * ("fill it in") and admin ("review the intake") route groups. Keyboard-aware,
 * single-column form that reflows chip options by available width.
 */
import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { INTAKE_STEPS } from "~/data/seed";

export function IntakeScreen() {
  const { theme, radius } = useTokens();
  const { gutter } = useResponsive();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [ans, setAns] = useState<Record<string, any>>({
    names: "Eleanor & James Whitfield", email: "eleanor.whitfield@hey.com",
    date: "14 June 2026", venue: "Stones of the Yarra Valley", guests: "",
    moments: { Ceremony: true, "Family formals": true, Reception: true }, notes: "",
  });

  const set = (k: string, v: any) => setAns((a) => ({ ...a, [k]: v }));
  const toggleMoment = (m: string) => setAns((a) => { const n = { ...a.moments }; n[m] ? delete n[m] : (n[m] = true); return { ...a, moments: n }; });
  const cur = INTAKE_STEPS[step];
  const last = step === INTAKE_STEPS.length - 1;

  if (done) {
    return (
      <ScrollView contentContainerStyle={{ padding: gutter, flexGrow: 1, justifyContent: "center" }}>
        <View style={{ maxWidth: 520, alignSelf: "center", alignItems: "center", borderWidth: 1, borderColor: theme.border.gold, borderRadius: radius.sm, backgroundColor: theme.surface.raised, padding: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.brand.goldMuted, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon name="check" size={26} color={theme.brand.gold} />
          </View>
          <Display size={30} style={{ marginBottom: 8 }}>Thank you</Display>
          <Body muted style={{ textAlign: "center" }}>Your pre-shoot questionnaire is with the studio. Victoria will use it to build your run sheet and photographer brief.</Body>
          <Button label="Review answers" variant="ghost" style={{ marginTop: 20 }} onPress={() => { setDone(false); setStep(0); }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: gutter }} keyboardShouldPersistTaps="handled">
        <View style={{ maxWidth: 640, width: "100%", alignSelf: "center" }}>
          <Eyebrow>Wedding intake</Eyebrow>
          <Display size={36} style={{ marginTop: 6, marginBottom: 14 }}>{cur.title}</Display>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 22 }}>
            {INTAKE_STEPS.map((_, i) => (
              <View key={i} style={{ height: 5, width: i === step ? 28 : 8, borderRadius: 3, backgroundColor: i < step ? theme.brand.gold : i === step ? theme.brand.goldHover : theme.border.default }} />
            ))}
            <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: theme.ink.tertiary, marginLeft: 6 }}>{step + 1} / {INTAKE_STEPS.length}</Text>
          </View>

          <View style={{ gap: 16 }}>
            {cur.fields.map((f: any) => (
              <View key={f.key}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: theme.ink.secondary, marginBottom: 6 }}>{f.label}</Text>
                {f.type === "chips" ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {f.options.map((o: string) => {
                      const on = !!ans.moments[o];
                      return (
                        <Pressable key={o} onPress={() => toggleMoment(o)} style={{ minHeight: 40, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9999, backgroundColor: on ? theme.brand.gold : theme.surface.raised, borderWidth: 1, borderColor: on ? theme.brand.gold : theme.border.default }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: on ? theme.ink.inverse : theme.ink.primary }}>{o}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    value={ans[f.key]}
                    onChangeText={(v) => set(f.key, v)}
                    placeholder={f.ph}
                    placeholderTextColor={theme.ink.tertiary}
                    multiline={f.type === "area"}
                    style={{ minHeight: f.type === "area" ? 110 : 46, textAlignVertical: f.type === "area" ? "top" : "center", paddingHorizontal: 14, paddingVertical: f.type === "area" ? 12 : 0, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, color: theme.ink.primary, fontSize: 15 }}
                  />
                )}
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 26, alignItems: "center" }}>
            {step > 0 ? <Button label="Back" icon="chevronL" variant="ghost" onPress={() => setStep((s) => s - 1)} /> : null}
            <View style={{ flex: 1 }} />
            <Button label={last ? "Submit" : "Continue"} icon="chevronR" onPress={() => (last ? setDone(true) : setStep((s) => s + 1))} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
