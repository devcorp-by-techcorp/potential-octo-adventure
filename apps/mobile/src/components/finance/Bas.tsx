/**
 * GST & BAS — the quarterly Business Activity Statement worksheet.
 * Simpler BAS reports G1, 1A and 1B; the G10/G11 rows are kept for the
 * studio's own records. Figures follow the selected accounting basis.
 */
import React from "react";
import { View } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { Card, Eyebrow } from "~/components/ui";
import { Seg, SegBar, BasRow, Note, Mono } from "./parts";
import {
  FIN_CURRENT_QUARTER, FIN_PAYGI_RATE, FIN_PERIODS, finBAS, finFmt,
  type Expense, type FinInvoice, type FinSettings,
} from "~/data/finance";

export const Bas: React.FC<{ settings: FinSettings; invoices: FinInvoice[]; expenses: Expense[] }> = ({ settings, invoices, expenses }) => {
  const { theme, space } = useTokens();
  const [qKey, setQKey] = React.useState(FIN_CURRENT_QUARTER.key);
  const quarter = FIN_PERIODS.quarters.find((q) => q.key === qKey) ?? FIN_PERIODS.quarters[0];
  const bas = finBAS(quarter, invoices, expenses, settings);

  if (!settings.gstRegistered) {
    return (
      <Card style={{ padding: 24, gap: 12 }}>
        <Eyebrow>No Activity Statement Required</Eyebrow>
        <Note>
          The studio is currently set as not registered for GST, so no BAS is lodged and no GST is charged on invoices.
          Registration becomes mandatory once GST turnover reaches $75,000 in any rolling 12-month period — switch GST
          Registration on in Overview to activate the GST system, tax-invoice templates and this quarterly worksheet.
        </Note>
      </Card>
    );
  }

  return (
    <View style={{ gap: space.s4 }}>
      <SegBar>
        {FIN_PERIODS.quarters.map((q) => (
          <Seg key={q.key} label={q.short} on={qKey === q.key} onPress={() => setQKey(q.key)} />
        ))}
      </SegBar>

      <Card style={{ padding: 18 }}>
        <Eyebrow>Business Activity Statement · {quarter.label}</Eyebrow>
        <Mono>Simpler BAS · {settings.basis} basis</Mono>

        <View style={{ marginTop: 18, marginBottom: 2 }}>
          <Eyebrow color={theme.ink.tertiary}>Goods and services tax</Eyebrow>
        </View>
        <BasRow code="G1" label="Total sales (GST-inclusive)" value={bas.G1} note={`${bas.salesCount} ${settings.basis === "cash" ? "payments received" : "invoices issued"} this quarter`} />
        <BasRow code="1A" label="GST on sales" value={bas.A1} />
        <BasRow code="G10" label="Capital purchases" value={bas.G10} />
        <BasRow code="G11" label="Non-capital purchases" value={bas.G11} note="Wages and superannuation are not purchases — reported at W1, not G11" />
        <BasRow code="1B" label="GST on purchases (input tax credits)" value={bas.B1} />

        <View style={{ marginTop: 18, marginBottom: 2 }}>
          <Eyebrow color={theme.ink.tertiary}>PAYG tax withheld</Eyebrow>
        </View>
        <BasRow code="W1" label="Total salary, wages and other payments" value={bas.W1} />
        <BasRow code="W2" label="Amount withheld from payments at W1" value={bas.W2} />

        <View style={{ marginTop: 18, marginBottom: 2 }}>
          <Eyebrow color={theme.ink.tertiary}>PAYG income tax instalment</Eyebrow>
        </View>
        <BasRow code="T1" label="Instalment income (GST-exclusive sales)" value={bas.T1} />
        <BasRow code="5A" label={`Instalment — T1 × ${(FIN_PAYGI_RATE * 100).toFixed(1)}% (ATO-notified rate)`} value={bas.A5} />

        <View style={{ marginTop: 18, borderTopWidth: 1, borderColor: theme.border.gold, paddingTop: 4 }}>
          <BasRow code="" label="Net GST (1A − 1B)" value={bas.gstNet} strong />
          <BasRow
            code=""
            label={bas.netPayable >= 0 ? "Amount payable this statement" : "Refund due this statement"}
            value={Math.abs(bas.netPayable)}
            strong
            note="Net GST + PAYG withheld (W2) + PAYG instalment (5A)"
          />
        </View>
      </Card>

      <Card style={{ padding: 18, gap: 4 }}>
        <Eyebrow>Lodgment</Eyebrow>
        <Row label="Period" value={`${finFmt(quarter.start)} – ${finFmt(quarter.end)}`} />
        <Row label="Due for lodgment" value={finFmt(quarter.due ?? quarter.end, { day: "numeric", month: "long", year: "numeric" })} gold />
        <Row label="Reporting method" value="Simpler BAS" />
      </Card>

      <Note>
        Simpler BAS reports G1, 1A and 1B only; the G10/G11 worksheet rows are kept for the studio's records.
        Figures follow the {settings.basis} accounting basis. Review with a registered BAS agent before lodging
        through Online services for business.
      </Note>
    </View>
  );
};

const Row: React.FC<{ label: string; value: string; gold?: boolean }> = ({ label, value, gold }) => {
  const { theme } = useTokens();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
      <Mono size={12} color={theme.ink.secondary}>{label}</Mono>
      <Mono size={12} color={gold ? theme.brand.gold : theme.ink.primary}>{value}</Mono>
    </View>
  );
};
