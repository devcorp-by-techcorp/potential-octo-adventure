/**
 * Accounts — the double-entry general ledger and the chart of accounts.
 * The journal is kept accrual-complete; the cash/accrual setting governs
 * recognition in the BAS and reports, not the record.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { Card, Eyebrow } from "~/components/ui";
import { Seg, SegBar, Note, Mono } from "./parts";
import {
  FIN_ACCOUNT_TYPES, FIN_COA, finAUD, finAccount, finFmt, finInPeriod, finLedger, finR2,
  type Expense, type FinInvoice, type FinSettings, type Period,
} from "~/data/finance";

export const Accounts: React.FC<{ settings: FinSettings; period: Period; invoices: FinInvoice[]; expenses: Expense[] }> = ({ settings, period, invoices, expenses }) => {
  const { theme, space } = useTokens();
  const [view, setView] = React.useState<"ledger" | "coa">("ledger");
  const entries = React.useMemo(
    () => finLedger(invoices, expenses, settings).filter((e) => finInPeriod(e.date, period)),
    [invoices, expenses, settings, period]
  );
  const totalDr = finR2(entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.dr, 0), 0));
  const totalCr = finR2(entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.cr, 0), 0));

  return (
    <View style={{ gap: space.s4 }}>
      <SegBar>
        <Seg label="General Ledger" on={view === "ledger"} onPress={() => setView("ledger")} />
        <Seg label="Chart of Accounts" on={view === "coa"} onPress={() => setView("coa")} />
      </SegBar>

      {view === "coa" ? (
        <View style={{ gap: 12 }}>
          {FIN_ACCOUNT_TYPES.map((t) => {
            const accounts = FIN_COA.filter((a) => a.type === t);
            if (!accounts.length) return null;
            return (
              <Card key={t} style={{ padding: 18 }}>
                <Eyebrow>{t}</Eyebrow>
                <View style={{ marginTop: 10 }}>
                  {accounts.map((a) => (
                    <View key={a.code} style={{ flexDirection: "row", gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
                      <Mono size={11} color={theme.brand.gold}>{a.code}</Mono>
                      <Text style={{ flex: 1, minWidth: 0, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Eyebrow>Journal · {period.label} · {entries.length} entries</Eyebrow>
            <Mono size={11.5} color={totalDr === totalCr ? theme.ink.tertiary : theme.brand.gold}>
              DR {finAUD(totalDr)} · CR {finAUD(totalCr)} {totalDr === totalCr ? "· in balance" : "· OUT OF BALANCE"}
            </Mono>
          </View>

          {entries.map((e, i) => (
            <Card key={`${e.ref}-${e.date}-${i}`} style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Mono size={11.5} color={theme.ink.secondary}>{finFmt(e.date)}</Mono>
                <Mono size={11} color={theme.brand.gold}>{e.ref}</Mono>
              </View>
              <Note>{e.memo}</Note>
              <View style={{ gap: 4 }}>
                {e.lines.map((l, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                    <Mono size={10.5}>{l.account}</Mono>
                    <Text style={{ flex: 1, minWidth: 0, fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 17, color: theme.ink.secondary }}>{finAccount(l.account).name}</Text>
                    <Mono size={11} color={l.dr > 0 ? theme.ink.primary : theme.ink.tertiary}>{l.dr > 0 ? `DR ${finAUD(l.dr)}` : `CR ${finAUD(l.cr)}`}</Mono>
                  </View>
                ))}
              </View>
            </Card>
          ))}

          {entries.length === 0 ? (
            <Card style={{ padding: 28 }}>
              <Note>No journal entries in this period.</Note>
            </Card>
          ) : null}
        </View>
      )}
    </View>
  );
};
