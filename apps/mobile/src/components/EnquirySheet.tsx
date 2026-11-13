/**
 * "Begin an enquiry" — the studio site's tentative-request flow as a three-step
 * sheet: the date and session → your details → received.
 *
 * Choosing a date reserves nothing. A submission is a real record: it lands in
 * the studio's Inquiries as a tentative request and is confirmed (or not) by
 * the studio. Dates that already carry a confirmed booking are struck through
 * and refused; past dates are refused. No pricing is shown.
 *
 * Bottom sheet on a handset, centred panel when there is width.
 */
import React from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { PACKAGES, STUDIO_TODAY } from "~/data/seed";
import { useRecords } from "~/state/records";

export const ENQUIRY_TYPES = ["Wedding", "Editorial", "Family", "Portrait", "Brand / Commercial"];
const MONTH_MIN = "2026-05";
const MONTH_MAX = "2027-12";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const pad2 = (n: number) => String(n).padStart(2, "0");
const longDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const BLANK = { name: "", email: "", phone: "", venue: "", message: "" };

export const EnquirySheet: React.FC<{ visible: boolean; onClose: () => void; initialPackage?: string | null }> = ({ visible, onClose, initialPackage }) => {
  const { theme, radius } = useTokens();
  const { width, fs } = useResponsive();
  const insets = useSafeAreaInsets();
  const { confirmedDates, submitEnquiry } = useRecords();

  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [month, setMonth] = React.useState("2026-06");
  const [date, setDate] = React.useState<string | null>(null);
  const [type, setType] = React.useState("Wedding");
  const [pkg, setPkg] = React.useState("Signature");
  const [v, setV] = React.useState(BLANK);
  const [error, setError] = React.useState("");
  const [ref, setRef] = React.useState("");

  // Opening from a collection card preselects that collection.
  React.useEffect(() => { if (visible && initialPackage) setPkg(initialPackage); }, [visible, initialPackage]);

  const close = () => {
    onClose();
    setError("");
    if (step === 2) { setStep(0); setDate(null); setV(BLANK); setRef(""); } else setStep(0);
  };

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(y, m, 0).getDate();
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    if (key < MONTH_MIN) return setError("The calendar opens from May 2026.");
    if (key > MONTH_MAX) return setError("Dates past December 2027 are not open yet.");
    setError(""); setMonth(key);
  };
  const kindOf = (iso: string) => (iso <= STUDIO_TODAY ? "past" : confirmedDates.has(iso) ? "booked" : "open");
  const pick = (iso: string) => {
    const k = kindOf(iso);
    if (k === "past") return setError("That date has already passed.");
    if (k === "booked") return setError(`${longDate(iso)} is unavailable — choose another.`);
    setDate(iso); setError("");
  };

  const next = () => {
    if (step === 0) {
      if (!date) return setError("Choose a preferred date to continue.");
      setError(""); return setStep(1);
    }
    if (step === 1) {
      if (!v.name.trim()) return setError("A name is required.");
      if (!EMAIL_RE.test(v.email.trim())) return setError("A valid email is required — the studio replies there.");
      setRef(submitEnquiry({ date: date!, type, pkg, ...v }));
      setError(""); return setStep(2);
    }
    close();
  };
  const back = () => { if (step === 0) return close(); setError(""); setStep(0); };

  const wide = width >= 640;
  const cell = Math.max(40, Math.min(48, Math.floor((Math.min(width, 560) - 40 - 6 * 4) / 7)));
  const label9 = { fontFamily: "Inter_600SemiBold", textTransform: "uppercase" as const, letterSpacing: 1.5, fontSize: 9.5, color: theme.ink.tertiary };
  const input = { minHeight: 46, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs, backgroundColor: theme.surface.raised, fontFamily: "Inter_400Regular", fontSize: 15, color: theme.ink.primary };
  const chip = (on: boolean) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: "center" as const, borderRadius: 999, borderWidth: 1, borderColor: on ? theme.brand.gold : theme.border.default, backgroundColor: on ? theme.brand.gold : theme.surface.raised });
  const chipText = (on: boolean) => ({ fontFamily: "Inter_600SemiBold", fontSize: 11.5, letterSpacing: 0.4, color: on ? theme.ink.inverse : theme.ink.secondary });
  const field = (k: keyof typeof BLANK, label: string, placeholder: string, opts: { keyboard?: "email-address" | "phone-pad"; caps?: "none" | "words"; half?: boolean } = {}) => (
    <View style={{ flexBasis: opts.half && wide ? "47%" : "100%", flexGrow: 1, gap: 6 }}>
      <Text style={label9}>{label}</Text>
      <TextInput value={v[k]} onChangeText={(t) => { setV((s) => ({ ...s, [k]: t })); setError(""); }} placeholder={placeholder} placeholderTextColor={theme.ink.tertiary}
        accessibilityLabel={label} keyboardType={opts.keyboard} autoCapitalize={opts.caps} autoCorrect={false} style={input} />
    </View>
  );

  const stepLabel = ["Step 1 of 3 · The date", "Step 2 of 3 · Your details", "Step 3 of 3 · Received"][step];
  const title = ["Select a preferred date", "Tell us about the day", "Received for review"][step];

  return (
    <Modal visible={visible} transparent animationType={wide ? "fade" : "slide"} onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={close} accessibilityLabel="Close enquiry" style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: wide ? "center" : "flex-end", alignItems: "center", padding: wide ? 20 : 0 }}>
          <Pressable onPress={() => {}} accessibilityViewIsModal
            style={[{ width: "100%", maxWidth: 560, maxHeight: wide ? "92%" : "94%", backgroundColor: theme.surface.canvas, borderWidth: 1, borderColor: theme.border.gold, overflow: "hidden" },
              wide ? { borderRadius: 8 } : { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomWidth: 0 }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[label9, { color: theme.brand.gold }]}>{stepLabel}</Text>
                <Text accessibilityRole="header" style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: fs(26), color: theme.ink.primary, marginTop: 4 }}>{title}</Text>
              </View>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={20} color={theme.ink.tertiary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingTop: 12 }}>
              {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 999, backgroundColor: i <= step ? theme.brand.gold : theme.border.default }} />)}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
              {step === 0 ? (
                <>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, color: theme.ink.secondary }}>
                    Choosing a date sends a tentative request for studio review — no date is reserved, held or confirmed by this form. Struck-through dates already carry a confirmed booking.
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs }}>
                      <Icon name="chevronL" size={18} color={theme.ink.secondary} />
                    </Pressable>
                    <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 20, color: theme.ink.primary }}>{first.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</Text>
                    <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs }}>
                      <Icon name="chevronR" size={18} color={theme.ink.secondary} />
                    </Pressable>
                  </View>
                  <View style={{ alignSelf: "center", width: cell * 7 + 24 }}>
                    <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                      {WEEKDAYS.map((d) => <Text key={d} style={[label9, { width: cell, textAlign: "center", fontSize: 9 }]}>{d}</Text>)}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                      {Array.from({ length: lead }).map((_, i) => <View key={"l" + i} style={{ width: cell, height: cell }} />)}
                      {Array.from({ length: days }).map((_, i) => {
                        const iso = `${month}-${pad2(i + 1)}`;
                        const k = kindOf(iso), on = date === iso;
                        return (
                          <Pressable key={iso} onPress={() => pick(iso)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: k !== "open" }}
                            accessibilityLabel={`${longDate(iso)}${k === "booked" ? ", unavailable" : k === "past" ? ", past" : on ? ", selected" : ""}`}
                            style={{ width: cell, height: cell, alignItems: "center", justifyContent: "center", borderRadius: radius.xs, borderWidth: 1,
                              borderColor: on ? theme.brand.gold : k === "open" ? theme.border.default : theme.border.subtle,
                              backgroundColor: on ? theme.brand.gold : k === "booked" ? theme.surface.inset : k === "past" ? "transparent" : theme.surface.raised }}>
                            <Text style={{ fontFamily: on ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 14, color: on ? theme.ink.inverse : k === "open" ? theme.ink.primary : theme.ink.tertiary, textDecorationLine: k === "booked" ? "line-through" : "none", opacity: k === "past" ? 0.55 : 1 }}>{i + 1}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
                    {([["Available", theme.surface.raised, theme.border.default], ["Unavailable", theme.surface.inset, theme.border.subtle], ["Past", "transparent", theme.border.subtle]] as const).map(([l, bg, bd]) => (
                      <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: bg, borderWidth: 1, borderColor: bd }} />
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: theme.ink.tertiary }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ height: 1, backgroundColor: theme.border.subtle }} />
                  <View style={{ gap: 8 }}>
                    <Text style={label9}>What kind of session?</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {ENQUIRY_TYPES.map((t) => (
                        <Pressable key={t} onPress={() => { setType(t); setError(""); }} accessibilityRole="button" accessibilityState={{ selected: type === t }} style={chip(type === t)}><Text style={chipText(type === t)}>{t}</Text></Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    <Text style={label9}>Collection you have in mind</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {PACKAGES.map((p) => (
                        <Pressable key={p.name} onPress={() => { setPkg(p.name); setError(""); }} accessibilityRole="button" accessibilityState={{ selected: pkg === p.name }} accessibilityLabel={`${p.name} collection`} style={chip(pkg === p.name)}><Text style={chipText(pkg === p.name)}>{p.name}</Text></Pressable>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border.gold, borderRadius: radius.xs, backgroundColor: theme.brand.goldMuted }}>
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{[date ? longDate(date) : "No date chosen", type, pkg].join("  ·  ")}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    {field("name", "Full name · required", "Who should we write to?", { caps: "words", half: true })}
                    {field("email", "Email · required", "you@email.com", { keyboard: "email-address", caps: "none", half: true })}
                    {field("phone", "Phone", "+61 4…", { keyboard: "phone-pad", half: true })}
                    {field("venue", "Venue or location", "Where is it happening?", { half: true })}
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={label9}>A few words about the day</Text>
                    <TextInput value={v.message} onChangeText={(t) => setV((s) => ({ ...s, message: t }))} placeholder="Anything that would help us picture it…" placeholderTextColor={theme.ink.tertiary}
                      accessibilityLabel="A few words about the day" multiline numberOfLines={4} style={[input, { minHeight: 96, textAlignVertical: "top" }]} />
                  </View>
                </>
              ) : null}

              {step === 2 ? (
                <View style={{ alignItems: "center", gap: 12, paddingVertical: 12 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: theme.border.gold, backgroundColor: theme.brand.goldMuted, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="check" size={28} color={theme.brand.gold} />
                  </View>
                  <Text selectable style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 18, letterSpacing: 1.5, color: theme.brand.gold }}>{ref}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, color: theme.ink.secondary, textAlign: "center", maxWidth: 420 }}>
                    {date ? `Your tentative request for ${longDate(date)} has been received for studio review. Nothing is reserved, held or confirmed until the studio confirms it with you.` : "Your tentative request has been received for studio review."}
                  </Text>
                </View>
              ) : null}

              {error ? (
                <View accessibilityRole="alert" style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.xs, borderWidth: 1, borderColor: theme.status.warning, backgroundColor: "rgba(212,163,86,0.12)" }}>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 + (wide ? 0 : insets.bottom), borderTopWidth: 1, borderTopColor: theme.border.subtle }}>
              {step < 2 ? <Button label={step === 0 ? "Cancel" : "Change date"} variant="ghost" onPress={back} /> : null}
              <Button label={step === 0 ? "Continue" : step === 1 ? "Send tentative request" : "Close"} icon={step === 1 ? "arrow" : undefined} onPress={next} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
