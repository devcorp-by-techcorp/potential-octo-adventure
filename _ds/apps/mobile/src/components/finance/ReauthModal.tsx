/**
 * Password re-entry gate. Editing or deleting a saved expense runs this twice
 * — once to unlock the workflow, once to finalise it. A failed attempt is
 * written to the audit trail before the field is cleared.
 */
import React from "react";
import { View, Text, Modal, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Display, Button, Eyebrow } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { Note } from "./parts";
import { finVerifyPassword, useFinance } from "~/state/finance";

export const ReauthModal: React.FC<{
  open: boolean; title: string; message: string; confirmLabel: string;
  danger?: boolean; summary?: React.ReactNode; refId?: string | null;
  onCancel: () => void; onVerified: () => void;
}> = ({ open, title, message, confirmLabel, danger, summary, refId, onCancel, onVerified }) => {
  const { theme, radius, space } = useTokens();
  const { fs, width } = useResponsive();
  const { append } = useFinance();
  const [pw, setPw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setPw(""); setError(null); } }, [open, title]);
  if (!open) return null;

  const submit = () => {
    if (finVerifyPassword(pw)) { onVerified(); return; }
    setError("That password is not correct. This attempt has been recorded.");
    setPw("");
    append({ action: "auth_failed", ref: refId, ok: false, summary: `Password verification failed — ${title}` });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: "rgba(12,14,18,0.62)", justifyContent: "center", padding: 20 }}>
          <Pressable
            onPress={() => {}}
            style={{ alignSelf: "center", width: "100%", maxWidth: Math.min(width - 40, 480), backgroundColor: theme.surface.raised, borderWidth: 1, borderColor: theme.border.gold, borderRadius: radius.sm }}
          >
            <ScrollView contentContainerStyle={{ padding: 22, gap: space.s3 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="lock" size={18} color={theme.brand.gold} />
                <Eyebrow>Security check</Eyebrow>
              </View>

              <Display size={24}>{title}</Display>
              <Note>{message}</Note>

              {summary ? (
                <View style={{ backgroundColor: theme.surface.inset, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: radius.xs, padding: 14, gap: 6 }}>{summary}</View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 10, color: theme.ink.tertiary }}>Re-enter your password</Text>
                <TextInput
                  value={pw}
                  onChangeText={(t) => { setPw(t); setError(null); }}
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  placeholderTextColor={theme.ink.tertiary}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                  style={{ minHeight: 48, borderWidth: 1, borderColor: error ? theme.status.warning : theme.border.default, borderRadius: radius.xs, paddingHorizontal: 14, fontFamily: "Inter_400Regular", fontSize: fs(14), color: theme.ink.primary, backgroundColor: theme.surface.inset }}
                />
                {error ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon name="alert" size={14} color={theme.status.warning} />
                    <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, color: theme.status.warning }}>{error}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Button label={confirmLabel} onPress={submit} />
                <Button label="Cancel" variant="ghost" onPress={onCancel} />
              </View>

              <Note>Demo password: illuminate</Note>

              <View style={{ borderTopWidth: 1, borderColor: theme.border.subtle, paddingTop: 12 }}>
                <Note>
                  {danger ? "This deletion" : "This action"} is written to the finance audit trail with your identity, device and timestamp. Failed attempts are recorded.
                </Note>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
