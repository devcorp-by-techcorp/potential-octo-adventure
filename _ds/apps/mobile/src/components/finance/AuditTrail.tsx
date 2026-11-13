/**
 * Audit trail — read-only view of the append-only, hash-chained log.
 * Entries are system-generated at the moment of each action; the chain badge
 * re-verifies the whole log on every render.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { Card, Badge, Eyebrow } from "~/components/ui";
import { Note, Mono } from "./parts";
import { FIN_AUDIT_ACTIONS, useFinance, type AuditEntry } from "~/state/finance";
import { finAUD, finFmt } from "~/data/finance";

const fmtTs = (iso: string) => {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" }) +
    " · " +
    d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  );
};

const Entry: React.FC<{ e: AuditEntry }> = ({ e }) => {
  const { theme } = useTokens();
  const a = FIN_AUDIT_ACTIONS[e.action] ?? { label: e.action, tone: "muted" as const };
  return (
    <Card style={{ padding: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Mono>#{String(e.seq).padStart(3, "0")}</Mono>
        <Mono size={11.5} color={theme.ink.secondary}>{fmtTs(e.ts)}</Mono>
        <Badge label={a.label} tone={a.tone} />
        {e.ref ? <Mono color={theme.brand.gold}>{String(e.ref).toUpperCase()}</Mono> : null}
      </View>

      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, color: theme.ink.primary }}>{e.summary}</Text>

      {e.changes && e.changes.length > 0 ? (
        <View style={{ borderLeftWidth: 1, borderColor: theme.border.gold, paddingLeft: 12, gap: 6 }}>
          {e.changes.map((c, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9.5, color: theme.ink.tertiary }}>{c.field}</Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11.5, color: theme.ink.primary }}>
                <Text style={{ color: theme.ink.tertiary, textDecorationLine: "line-through" }}>{c.from}</Text>
                <Text style={{ color: theme.brand.gold }}>{"  →  "}</Text>
                {c.to}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {e.record ? (
        <View style={{ borderLeftWidth: 1, borderColor: theme.border.subtle, paddingLeft: 12 }}>
          <Mono size={11.5} color={theme.ink.secondary}>
            Final record: {finFmt(e.record.date)} · {e.record.supplier} · {e.record.desc} · {finAUD(e.record.gross)}
          </Mono>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 }}>
        <Mono size={10}>{e.actor} · {e.role}</Mono>
        <Mono size={10}>{e.device.os}</Mono>
        <Mono size={10}>{e.method}</Mono>
        <Mono size={10}>tz {e.tz}</Mono>
        <Mono size={10}>hash {e.hash.slice(0, 10)} ⇠ {e.prevHash === "genesis" ? "genesis" : e.prevHash.slice(0, 10)}</Mono>
      </View>
    </Card>
  );
};

export const AuditTrail: React.FC = () => {
  const { audit, chainIntact } = useFinance();
  const entries = [...audit].reverse();

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>Audit Trail · Expense Register</Eyebrow>
          <Note>{audit.length} event{audit.length === 1 ? "" : "s"} · append-only · hash-chained for tamper evidence</Note>
        </View>
        {audit.length > 0 ? <Badge label={chainIntact ? "chain intact" : "chain broken"} tone={chainIntact ? "success" : "warning"} /> : null}
      </View>

      <View style={{ gap: 8 }}>
        {entries.map((e) => <Entry key={e.seq} e={e} />)}
        {entries.length === 0 ? (
          <Card style={{ padding: 28 }}>
            <Note>No audit events yet. Editing or deleting an expense — and any failed password attempt — will be recorded here automatically.</Note>
          </Card>
        ) : null}
      </View>

      <Note>
        Entries are system-generated at the moment of each action and cannot be edited or removed. Each entry carries the hash of the one before it — the chain status above re-verifies the full log on every view.
      </Note>
    </View>
  );
};
