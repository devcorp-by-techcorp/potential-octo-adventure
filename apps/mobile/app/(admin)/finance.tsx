/**
 * Finance — the studio's books: what has been invoiced and received, what the
 * register has cost, the quarterly BAS, the statements, and the ledger behind
 * them. Figures are derived, never stored: seeded prior-season invoices plus
 * the retainer / balance ladder read off each booking's phase, and the expense
 * register held in finance state.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Card, Badge } from "~/components/ui";
import { dateLabel, dateShort, STUDIO_TODAY } from "~/data/seed";
import { useRecords } from "~/state/records";
import { useRouter, useLocalSearchParams } from "expo-router";
import { FIN_PERIODS, finAUD, finInvoices, type Period } from "~/data/finance";
import { useFinance } from "~/state/finance";
import { Seg, SegBar, PeriodBar, Note, Mono } from "~/components/finance/parts";
import { ExpenseRegister } from "~/components/finance/ExpenseRegister";
import { AuditTrail } from "~/components/finance/AuditTrail";
import { Bas } from "~/components/finance/Bas";
import { Reports } from "~/components/finance/Reports";
import { Accounts } from "~/components/finance/Accounts";
import { Suppliers } from "~/components/finance/Suppliers";

type Tab = "overview" | "invoices" | "expenses" | "suppliers" | "bas" | "reports" | "accounts";

export default function Finance() {
  const { theme, space } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const { settings, setSettings, expenses, audit } = useFinance();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; q?: string }>();
  const pTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const pQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const isTab = (v: unknown): v is Tab => typeof v === "string" && ["overview", "invoices", "expenses", "suppliers", "bas", "reports", "accounts"].includes(v);
  const [tab, setTab] = React.useState<Tab>(isTab(pTab) ? pTab : "overview");
  // Deep links from the directory (a partner's record, or settled invoices).
  React.useEffect(() => { if (isTab(pTab)) setTab(pTab); }, [pTab]);
  const [filter, setFilter] = React.useState<"all" | "paid" | "due" | "overdue">("all");
  const [expenseView, setExpenseView] = React.useState<"register" | "audit">("register");
  const [period, setPeriod] = React.useState<Period>(FIN_PERIODS.fy);

  const { bookings } = useRecords();
  const invoices = React.useMemo(() => finInvoices(bookings, settings), [bookings, settings]);
  const fy = invoices.filter((i) => i.issue >= "2025-07-01" && i.issue <= "2026-06-30");
  const invoiced = fy.reduce((s, i) => s + i.gross, 0);
  const received = fy.filter((i) => i.paid).reduce((s, i) => s + i.gross, 0);
  const overdue = invoices.filter((i) => i.status === "overdue");
  const receivables = invoices.filter((i) => !i.paid).sort((a, b) => a.due.localeCompare(b.due));
  const rows = invoices.filter((i) => (filter === "all" ? true : i.status === filter));
  const kpiCols = width >= 760 ? 4 : width >= 420 ? 2 : 1;

  const kpis = [
    { label: "Invoiced · FY 25–26", value: money(invoiced), hint: settings.gstRegistered ? "gross · GST inclusive" : "gross · no GST registration" },
    { label: "Received", value: money(received), hint: "settled invoices" },
    { label: "Outstanding", value: money(invoiced - received), hint: "awaiting payment", accent: true },
    { label: "Overdue", value: String(overdue.length), hint: overdue.length ? money(overdue.reduce((s, i) => s + i.gross, 0)) + " past due" : "nothing past due" },
  ];

  const needsPeriod = tab === "expenses" || tab === "reports" || tab === "accounts";

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s4 }} keyboardShouldPersistTaps="handled">
      <View>
        <Eyebrow>Finance</Eyebrow>
        <Body muted size={13} style={{ marginTop: 8 }}>
          The studio's books — as at {dateLabel(STUDIO_TODAY)}.
        </Body>
      </View>

      <SegBar>
        <Seg label="Overview" on={tab === "overview"} onPress={() => setTab("overview")} />
        <Seg label="Invoices" on={tab === "invoices"} onPress={() => setTab("invoices")} />
        <Seg label="Expenses" on={tab === "expenses"} onPress={() => setTab("expenses")} />
        <Seg label="Suppliers" on={tab === "suppliers"} onPress={() => setTab("suppliers")} />
        <Seg label="GST & BAS" on={tab === "bas"} onPress={() => setTab("bas")} />
        <Seg label="Reports" on={tab === "reports"} onPress={() => setTab("reports")} />
        <Seg label="Accounts" on={tab === "accounts"} onPress={() => setTab("accounts")} />
      </SegBar>

      {needsPeriod ? <PeriodBar value={period} onChange={setPeriod} /> : null}

      {tab === "overview" ? (
        <View style={{ gap: space.s5 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {kpis.map((k) => (
              <Card key={k.label} gold={k.accent} style={{ width: kpiCols === 1 ? "100%" : undefined, flexGrow: 1, flexBasis: kpiCols === 1 ? "100%" : 150, padding: fs(18) }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 9, color: k.accent ? theme.brand.gold : theme.ink.tertiary }}>{k.label}</Text>
                <Display size={32} style={{ marginTop: 10, color: k.accent ? theme.brand.gold : theme.ink.primary }}>{k.value}</Display>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontStyle: "italic", fontSize: 13, color: theme.ink.tertiary, marginTop: 4 }}>{k.hint}</Text>
              </Card>
            ))}
          </View>

          <View>
            <Eyebrow>Receivables</Eyebrow>
            <View style={{ marginTop: 12, gap: 8 }}>
              {receivables.map((i) => (
                <Card key={i.id} style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{i.client}</Text>
                    <Mono>{i.number} · due {dateShort(i.due)}</Mono>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Display size={17}>{money(i.gross)}</Display>
                    <Badge label={i.status} tone={i.status === "overdue" ? "warning" : "muted"} />
                  </View>
                </Card>
              ))}
              {receivables.length === 0 ? (
                <Card style={{ padding: 36, alignItems: "center" }}><Display size={19}>Every invoice is settled</Display></Card>
              ) : null}
            </View>
          </View>

          {/* Bookkeeping settings — the selections every calculator branches off. */}
          <Card style={{ padding: 18, gap: 14 }}>
            <View>
              <Eyebrow>Bookkeeping Settings</Eyebrow>
              <Note>These selections drive the GST system, invoice templates, BAS worksheet and every statement.</Note>
            </View>
            <Toggle
              label="GST registration"
              options={[["Registered", true], ["Not registered", false]]}
              value={settings.gstRegistered}
              onChange={(v) => setSettings({ gstRegistered: v as boolean })}
            />
            <Toggle
              label="Package price basis"
              options={[["GST inclusive", "inclusive"], ["GST exclusive", "exclusive"]]}
              value={settings.priceBasis}
              onChange={(v) => setSettings({ priceBasis: v as "inclusive" | "exclusive" })}
            />
            <Toggle
              label="Accounting basis"
              options={[["Cash", "cash"], ["Accrual", "accrual"]]}
              value={settings.basis}
              onChange={(v) => setSettings({ basis: v as "cash" | "accrual" })}
            />
            <Note>
              {settings.gstRegistered
                ? "GST is charged at 10% and reported quarterly on a Simpler BAS; invoices are issued as tax invoices."
                : "No GST is charged and no BAS is lodged. Registration is mandatory once GST turnover reaches $75,000 in any rolling 12 months."}
            </Note>
          </Card>
        </View>
      ) : null}

      {tab === "invoices" ? (
        <View style={{ gap: 12 }}>
          <SegBar>
            <Seg label="All" count={invoices.length} on={filter === "all"} onPress={() => setFilter("all")} />
            <Seg label="Paid" count={invoices.filter((i) => i.status === "paid").length} on={filter === "paid"} onPress={() => setFilter("paid")} />
            <Seg label="Due" count={invoices.filter((i) => i.status === "due").length} on={filter === "due"} onPress={() => setFilter("due")} />
            <Seg label="Overdue" count={overdue.length} on={filter === "overdue"} onPress={() => setFilter("overdue")} />
          </SegBar>
          <View style={{ gap: 8 }}>
            {rows.map((i) => (
              <Card key={i.id} style={{ padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{i.client}</Text>
                  <Note>{i.desc}</Note>
                  <Mono>{i.number} · issued {dateShort(i.issue)}{settings.gstRegistered ? ` · incl. ${finAUD(i.gst)} GST` : ""}</Mono>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Display size={17}>{money(i.gross)}</Display>
                  <Badge label={i.status} tone={i.status === "paid" ? "success" : i.status === "overdue" ? "warning" : "muted"} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      {tab === "expenses" ? (
        <View style={{ gap: space.s4 }}>
          <SegBar>
            <Seg label="Expense Register" on={expenseView === "register"} onPress={() => setExpenseView("register")} />
            <Seg label="Audit Trail" count={audit.length} on={expenseView === "audit"} onPress={() => setExpenseView("audit")} />
          </SegBar>
          {expenseView === "register" ? <ExpenseRegister settings={settings} period={period} /> : <AuditTrail />}
        </View>
      ) : null}

      {tab === "suppliers" ? <Suppliers initialQuery={pQuery} onAddPartner={() => router.push({ pathname: "/(admin)/contacts", params: { add: "partner" } })} onRecordExpense={() => { setTab("expenses"); setExpenseView("register"); }} /> : null}
      {tab === "bas" ? <Bas settings={settings} invoices={invoices} expenses={expenses} /> : null}
      {tab === "reports" ? <Reports settings={settings} period={period} invoices={invoices} expenses={expenses} /> : null}
      {tab === "accounts" ? <Accounts settings={settings} period={period} invoices={invoices} expenses={expenses} /> : null}
    </ScrollView>
  );
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

/** Two-option selector used by the bookkeeping settings. */
const Toggle: React.FC<{ label: string; options: [string, string | boolean][]; value: string | boolean; onChange: (v: string | boolean) => void }> = ({ label, options, value, onChange }) => {
  const { theme, radius } = useTokens();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 10, color: theme.ink.tertiary }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {options.map(([text, v]) => {
          const on = v === value;
          return (
            <Pressable
              key={String(v)}
              onPress={() => onChange(v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: radius.xs, borderWidth: 1, borderColor: on ? theme.border.gold : theme.border.subtle, backgroundColor: on ? theme.brand.goldMuted : theme.surface.inset }}
            >
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11.5, letterSpacing: 0.4, color: on ? theme.brand.gold : theme.ink.secondary }}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
