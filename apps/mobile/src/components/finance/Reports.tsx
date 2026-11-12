/**
 * Reports — profit & loss, cash flow, super guarantee, PAYG instalments and
 * the depreciation schedule, all for the selected period.
 */
import React from "react";
import { View, Text } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { Card, Badge, Eyebrow } from "~/components/ui";
import { RptRow, Note, Mono } from "./parts";
import {
  FIN_IAWO_THRESHOLD, FIN_PAYGI_RATE, FIN_PERIODS, FIN_SG_RATE, finAUD, finAUD0, finAccount,
  finBAS, finCashflow, finDepreciation, finFmt, finPL, finSuper,
  type Expense, type FinInvoice, type FinSettings, type Period,
} from "~/data/finance";

export const Reports: React.FC<{ settings: FinSettings; period: Period; invoices: FinInvoice[]; expenses: Expense[] }> = ({ settings, period, invoices, expenses }) => {
  const { theme, space } = useTokens();
  const pl = finPL(period, invoices, expenses, settings);
  const cf = finCashflow(period, invoices, expenses, settings);
  const sg = finSuper(expenses, settings);
  const dep = finDepreciation(expenses, settings);
  const fyInstalments = FIN_PERIODS.quarters.reduce((s, q) => s + finBAS(q, invoices, expenses, settings).A5, 0);
  const lines = (by: Record<string, number>) =>
    Object.entries(by).sort(([a], [b]) => a.localeCompare(b)).map(([code, v]) => ({ code, name: finAccount(code).name, v }));

  return (
    <View style={{ gap: space.s4 }}>
      <Card style={{ padding: 18 }}>
        <Eyebrow>Profit &amp; Loss Statement</Eyebrow>
        <Note>
          {period.label} · {settings.basis} basis · {settings.gstRegistered ? "GST-exclusive amounts" : "gross amounts (no GST registration)"}
        </Note>

        <Group title="Income" />
        {lines(pl.incomeBy).map((r) => <RptRow key={r.code} label={`${r.code} · ${r.name}`} value={r.v} />)}
        <RptRow label="Total income" value={pl.income} strong />

        {Object.keys(pl.cogsBy).length > 0 ? (
          <>
            <Group title="Cost of sales" />
            {lines(pl.cogsBy).map((r) => <RptRow key={r.code} label={`${r.code} · ${r.name}`} value={r.v} neg />)}
            <RptRow label="Gross profit" value={pl.grossProfit} strong />
          </>
        ) : null}

        <Group title="Operating expenses" />
        {lines(pl.expBy).map((r) => <RptRow key={r.code} label={`${r.code} · ${r.name}`} value={r.v} neg />)}
        <RptRow label="Total operating expenses" value={pl.opex} strong neg />

        <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: theme.border.gold }}>
          <RptRow label="Net profit before income tax" value={pl.netProfit} strong gold />
        </View>
      </Card>

      <Card style={{ padding: 18 }}>
        <Eyebrow>Cash Flow · {period.label}</Eyebrow>
        <View style={{ marginTop: 12 }}>
          <RptRow label="Opening bank balance" value={cf.opening} />
          <RptRow label="Cash receipts (incl. GST collected)" value={cf.inflow} />
          <RptRow label="Cash payments (incl. GST paid, wages net of PAYG)" value={cf.outflow} neg />
          <RptRow label="Net cash movement" value={cf.net} strong />
          <RptRow label="Closing bank balance" value={cf.closing} strong gold />
        </View>
        {cf.withheld > 0 ? (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 17, color: theme.ink.tertiary, marginTop: 10 }}>
            {finAUD(cf.withheld)} of PAYG was withheld from wages this period. It is still in the bank and is owed to the ATO with the BAS.
          </Text>
        ) : null}
      </Card>

      <Card style={{ padding: 18 }}>
        <Eyebrow>Super Guarantee · {(FIN_SG_RATE * 100).toFixed(0)}%</Eyebrow>
        <Note>Payable on ordinary time earnings within 28 days of each quarter's end.</Note>
        <View style={{ marginTop: 12 }}>
          {sg.filter((r) => r.otes > 0).map((r) => (
            <View key={r.quarter.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12.5, color: theme.ink.primary }}>{r.quarter.label}</Text>
                <Mono>wages {finAUD(r.otes)} · due {finFmt(r.quarter.superDue ?? r.quarter.end)}</Mono>
              </View>
              <Mono size={12} color={theme.ink.primary}>{finAUD(r.sg)}</Mono>
              <Badge label={r.status} tone={r.status === "paid" ? "success" : r.status === "accruing" ? "muted" : "gold"} />
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ padding: 18 }}>
        <Eyebrow>PAYG Instalments · Estimate</Eyebrow>
        <Note>
          Instalment income × {(FIN_PAYGI_RATE * 100).toFixed(1)}% notified rate, paid quarterly with the BAS and credited against the year's income tax.
        </Note>
        <View style={{ marginTop: 12 }}>
          <RptRow label="FY instalments to date" value={fyInstalments} strong gold />
        </View>
      </Card>

      <Card style={{ padding: 18 }}>
        <Eyebrow>Depreciation Schedule</Eyebrow>
        <Note>
          Assets ≤ {finAUD0(FIN_IAWO_THRESHOLD)} (GST-exclusive) are written off in full when first used; costlier assets enter the general small business pool.
        </Note>
        <View style={{ marginTop: 12 }}>
          {dep.items.map((a) => (
            <View key={a.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border.subtle, gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ flex: 1, minWidth: 0, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18, color: theme.ink.primary }}>{a.desc.replace(" (asset)", "")}</Text>
                <Mono size={12} color={theme.ink.primary}>{finAUD(a.net)}</Mono>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ flex: 1, minWidth: 0, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, color: a.iawo ? theme.brand.gold : theme.ink.tertiary }}>{a.treatment}</Text>
                <Mono>deduction {finAUD(a.deduction)}</Mono>
              </View>
            </View>
          ))}
          <RptRow label="FY deduction total" value={dep.totalDeduction} strong gold />
        </View>
      </Card>
    </View>
  );
};

const Group: React.FC<{ title: string }> = ({ title }) => {
  const { theme } = useTokens();
  return (
    <View style={{ marginTop: 16, marginBottom: 2 }}>
      <Eyebrow color={theme.ink.tertiary}>{title}</Eyebrow>
    </View>
  );
};
