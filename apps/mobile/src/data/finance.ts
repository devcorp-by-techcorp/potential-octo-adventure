/**
 * Finance engine — the RN port of apps/web/src/features/finance/finance-core.jsx.
 *
 * Australian small-business bookkeeping for the studio, FY2025-26:
 *   · GST 10%, tax-inclusive pricing by default; the GST component of a
 *     GST-inclusive amount is amount ÷ 11 (ATO method).
 *   · Simpler BAS labels (G1, 1A, 1B) plus PAYG withholding (W1, W2) and a
 *     PAYG instalment estimate (T1 × the ATO-notified rate).
 *   · Financial year 1 July – 30 June; quarterly BAS periods with statutory
 *     lodgment due dates.
 *   · Super guarantee 12% of ordinary time earnings (rate from 1 July 2025),
 *     payable within 28 days of each quarter's end.
 *   · Instant asset write-off threshold $20,000 per asset; costlier assets
 *     enter the general small business pool (15% first-year deduction).
 *
 * Settings (GST registration, price basis, cash/accrual) are user-selected and
 * every calculator branches off them, so the correct system applies on
 * selection. Figures are always derived — never stored.
 */
import { STUDIO_TODAY, addDays, buildInvoices, type Booking, type Invoice } from "./seed";

export const FIN_TODAY = STUDIO_TODAY;
export const FIN_GST_RATE = 0.1;
export const FIN_SG_RATE = 0.12;
export const FIN_PAYGI_RATE = 0.045;
export const FIN_IAWO_THRESHOLD = 20000;

// ── money + date helpers ────────────────────────────────────────────────
export const finR2 = (n: number) => Math.round(n * 100) / 100;
export const finAUD = (n: number) =>
  "$" + (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const finAUD0 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
export const finGstOfGross = (gross: number) => finR2(gross / 11);
export const finFmt = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-AU", opts ?? { day: "2-digit", month: "short", year: "2-digit" });

// ── periods: FY 2025-26, quarters, months ───────────────────────────────
export interface Period { key: string; label: string; short: string; start: string; end: string; kind: "fy" | "quarter" | "month"; due?: string; superDue?: string; }

function buildPeriods() {
  const fy: Period = { key: "fy", label: "FY 2025–26", short: "FY 25–26", start: "2025-07-01", end: "2026-06-30", kind: "fy" };
  const quarters: Period[] = [
    { key: "q1", label: "Q1 · Jul–Sep 2025", short: "Q1", start: "2025-07-01", end: "2025-09-30", due: "2025-10-28", superDue: "2025-10-28", kind: "quarter" },
    { key: "q2", label: "Q2 · Oct–Dec 2025", short: "Q2", start: "2025-10-01", end: "2025-12-31", due: "2026-02-28", superDue: "2026-01-28", kind: "quarter" },
    { key: "q3", label: "Q3 · Jan–Mar 2026", short: "Q3", start: "2026-01-01", end: "2026-03-31", due: "2026-04-28", superDue: "2026-04-28", kind: "quarter" },
    { key: "q4", label: "Q4 · Apr–Jun 2026", short: "Q4", start: "2026-04-01", end: "2026-06-30", due: "2026-07-28", superDue: "2026-07-28", kind: "quarter" },
  ];
  const months: Period[] = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 6 ? 2025 : 2026;
    const m = ((6 + i) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    const last = new Date(y, m, 0).getDate();
    const d = new Date(y, m - 1, 1);
    months.push({
      key: `m-${y}-${mm}`,
      label: d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
      short: d.toLocaleDateString("en-AU", { month: "short" }) + " " + String(y).slice(2),
      start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}`, kind: "month",
    });
  }
  return { fy, quarters, months, all: [fy, ...quarters, ...months] };
}

export const FIN_PERIODS = buildPeriods();
export const finPeriod = (key: string) => FIN_PERIODS.all.find((p) => p.key === key) ?? FIN_PERIODS.fy;
export const finInPeriod = (iso: string | null | undefined, p: Period) => !!iso && iso >= p.start && iso <= p.end;
export const FIN_CURRENT_QUARTER = FIN_PERIODS.quarters.find((q) => finInPeriod(FIN_TODAY, q)) ?? FIN_PERIODS.quarters[3];

// ── settings (user-selected; drive systems + templates) ─────────────────
export interface FinSettings { gstRegistered: boolean; priceBasis: "inclusive" | "exclusive"; basis: "cash" | "accrual"; openingBalance: number; }
export const FIN_SETTINGS_DEFAULT: FinSettings = { gstRegistered: true, priceBasis: "inclusive", basis: "cash", openingBalance: 18450 };

// ── chart of accounts ───────────────────────────────────────────────────
export interface Account { code: string; name: string; type: string; }
export const FIN_COA: Account[] = [
  { code: "1-100", name: "Business Bank Account", type: "Asset" },
  { code: "1-110", name: "Accounts Receivable", type: "Asset" },
  { code: "1-210", name: "Equipment & Fit-out at Cost", type: "Asset" },
  { code: "2-100", name: "GST Collected", type: "Liability" },
  { code: "2-110", name: "GST Paid (Input Tax Credits)", type: "Liability" },
  { code: "2-120", name: "PAYG Withholding Payable", type: "Liability" },
  { code: "2-130", name: "Superannuation Payable", type: "Liability" },
  { code: "3-100", name: "Owner's Equity", type: "Equity" },
  { code: "3-200", name: "Retained Earnings", type: "Equity" },
  { code: "4-100", name: "Session Fees — Weddings", type: "Income" },
  { code: "4-110", name: "Session Fees — Portrait & Family", type: "Income" },
  { code: "4-120", name: "Session Fees — Editorial & Commercial", type: "Income" },
  { code: "4-130", name: "Prints, Albums & Products", type: "Income" },
  { code: "5-100", name: "Contractors & Second Shooters", type: "Cost of Sales" },
  { code: "5-110", name: "Printing & Album Production", type: "Cost of Sales" },
  { code: "6-100", name: "Advertising & Marketing", type: "Expense" },
  { code: "6-110", name: "Motor Vehicle & Travel", type: "Expense" },
  { code: "6-120", name: "Business Insurance", type: "Expense" },
  { code: "6-130", name: "Rent & Studio Hire", type: "Expense" },
  { code: "6-140", name: "Software & Subscriptions", type: "Expense" },
  { code: "6-150", name: "Phone & Internet", type: "Expense" },
  { code: "6-160", name: "Accounting & Professional Fees", type: "Expense" },
  { code: "6-170", name: "Training & Development", type: "Expense" },
  { code: "6-180", name: "Studio Consumables & Props", type: "Expense" },
  { code: "6-190", name: "Bank Fees & Charges", type: "Expense" },
  { code: "6-200", name: "Wages & Salaries", type: "Expense" },
  { code: "6-210", name: "Superannuation Expense", type: "Expense" },
  { code: "6-220", name: "Depreciation & Write-offs", type: "Expense" },
];
export const FIN_ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Cost of Sales", "Expense"];
export const finAccount = (code: string): Account => FIN_COA.find((a) => a.code === code) ?? { code, name: code, type: "" };

// ── expense categories (ATO-aligned, GST treatment encoded) ─────────────
// gst:false = no input tax credit. Wages and super are not purchases; bank
// fees are input-taxed financial supplies.
export interface Category { key: string; label: string; account: string; gst: boolean; capital?: boolean; wages?: boolean; }
export const FIN_EXPENSE_CATEGORIES: Category[] = [
  { key: "advertising", label: "Advertising & Marketing", account: "6-100", gst: true },
  { key: "motor", label: "Motor Vehicle & Travel", account: "6-110", gst: true },
  { key: "insurance", label: "Business Insurance", account: "6-120", gst: true },
  { key: "rent", label: "Rent & Studio Hire", account: "6-130", gst: true },
  { key: "equipment", label: "Equipment & Fit-out (capital)", account: "1-210", gst: true, capital: true },
  { key: "software", label: "Software & Subscriptions", account: "6-140", gst: true },
  { key: "phone", label: "Phone & Internet", account: "6-150", gst: true },
  { key: "professional", label: "Accounting & Professional Fees", account: "6-160", gst: true },
  { key: "contractors", label: "Contractors & Second Shooters", account: "5-100", gst: true },
  { key: "printing", label: "Printing & Album Production", account: "5-110", gst: true },
  { key: "wages", label: "Wages & Salaries", account: "6-200", gst: false, wages: true },
  { key: "super", label: "Superannuation", account: "6-210", gst: false },
  { key: "training", label: "Training & Development", account: "6-170", gst: true },
  { key: "consumables", label: "Studio Consumables & Props", account: "6-180", gst: true },
  { key: "bank", label: "Bank Fees & Charges", account: "6-190", gst: false },
];
export const finCategory = (key: string): Category => FIN_EXPENSE_CATEGORIES.find((c) => c.key === key) ?? FIN_EXPENSE_CATEGORIES[0];

export interface Expense { id: string; date: string; supplier: string; desc: string; category: string; gross: number; withheld?: number; edited?: number; editedAt?: string; }
export interface ComputedExpense extends Expense { cat: Category; gst: number; net: number; capital: boolean; }

/** A stored expense under the current settings. */
export function finExpense(e: Expense, settings: FinSettings): ComputedExpense {
  const cat = finCategory(e.category);
  const gst = settings.gstRegistered && cat.gst ? finGstOfGross(e.gross) : 0;
  return { ...e, cat, gst, net: finR2(e.gross - gst), capital: !!cat.capital };
}

// ── seeded expenses (FY to date) ────────────────────────────────────────
export function finSeedExpenses(): Expense[] {
  const rows: Expense[] = [];
  FIN_PERIODS.months.forEach((p) => {
    const m = p.start.slice(0, 7);
    rows.push({ id: `xr-${m}`, date: `${m}-03`, supplier: "Gertrude Street Studios", desc: "Studio rent — Fitzroy", category: "rent", gross: 1850 });
    rows.push({ id: `xs-${m}`, date: `${m}-10`, supplier: "Adobe / Pixieset", desc: "Creative suite & gallery hosting", category: "software", gross: 132 });
    rows.push({ id: `xp-${m}`, date: `${m}-15`, supplier: "Telstra Business", desc: "Studio phone & internet", category: "phone", gross: 89 });
    rows.push({ id: `xw-${m}`, date: `${m}-28`, supplier: "Payroll — Harper Boyd", desc: "Studio assistant wages (part-time)", category: "wages", gross: 2400, withheld: 312 });
    rows.push({ id: `xb-${m}`, date: `${m}-24`, supplier: "NAB Business", desc: "Account & merchant fees", category: "bank", gross: 14 });
  });
  rows.push(
    { id: "xo-01", date: "2025-07-15", supplier: "PPIB Insurance", desc: "Public liability + equipment policy (annual)", category: "insurance", gross: 1640 },
    { id: "xo-02", date: "2025-08-12", supplier: "CameraPro", desc: "Mirrorless camera body (asset)", category: "equipment", gross: 8900 },
    { id: "xo-03", date: "2025-09-20", supplier: "Fitzroy Shopfitters", desc: "Studio fit-out — cyclorama & lighting grid (asset)", category: "equipment", gross: 24500 },
    { id: "xo-04", date: "2025-10-06", supplier: "Wedshoots Directory", desc: "Annual directory listing", category: "advertising", gross: 480 },
    { id: "xo-05", date: "2025-10-19", supplier: "AIPP Workshop", desc: "Lighting masterclass — professional development", category: "training", gross: 760 },
    { id: "xo-06", date: "2025-10-21", supplier: "AustralianSuper", desc: "Super guarantee — Q1 (Jul–Sep)", category: "super", gross: 864 },
    { id: "xo-07", date: "2025-11-04", supplier: "CameraPro", desc: "85mm prime lens (asset)", category: "equipment", gross: 3450 },
    { id: "xo-08", date: "2025-11-08", supplier: "J. Okafor Photography", desc: "Second shooter — Kowalski wedding", category: "contractors", gross: 850 },
    { id: "xo-09", date: "2026-01-19", supplier: "AustralianSuper", desc: "Super guarantee — Q2 (Oct–Dec)", category: "super", gross: 864 },
    { id: "xo-10", date: "2026-01-22", supplier: "Prop & Palette", desc: "Backdrops & styling props", category: "consumables", gross: 230 },
    { id: "xo-11", date: "2026-02-09", supplier: "Meta Ads", desc: "Autumn booking campaign", category: "advertising", gross: 640 },
    { id: "xo-12", date: "2026-02-21", supplier: "J. Okafor Photography", desc: "Second shooter — Silva wedding", category: "contractors", gross: 850 },
    { id: "xo-13", date: "2026-03-18", supplier: "Marsh & Co Accountants", desc: "BAS preparation & bookkeeping review", category: "professional", gross: 990 },
    { id: "xo-14", date: "2026-04-14", supplier: "Momento Pro", desc: "Fine-art album production — client orders", category: "printing", gross: 1120 },
    { id: "xo-15", date: "2026-04-17", supplier: "AustralianSuper", desc: "Super guarantee — Q3 (Jan–Mar)", category: "super", gross: 864 },
    { id: "xo-16", date: "2026-04-22", supplier: "Shell / Linkt", desc: "Travel — Yarra Valley venue recce", category: "motor", gross: 146 },
    { id: "xo-17", date: "2026-05-02", supplier: "J. Okafor Photography", desc: "Second shooter — Whitfield wedding (deposit)", category: "contractors", gross: 850 },
  );
  return rows.filter((r) => r.date <= FIN_TODAY).sort((a, b) => b.date.localeCompare(a.date));
}

// ── invoices under the current settings ─────────────────────────────────
export interface FinInvoice extends Invoice { gst: number; net: number; }

/**
 * Booking-derived and seeded invoices with GST applied under the current
 * settings. An exclusive price basis grosses booking-derived amounts up by
 * the GST rate; settled prior-season invoices are already gross.
 */
export function finInvoices(bookings: Booking[], settings: FinSettings): FinInvoice[] {
  const up = settings.gstRegistered && settings.priceBasis === "exclusive";
  return buildInvoices(bookings).map((inv) => {
    const gross = up && inv.source === "derived" ? finR2(inv.gross * (1 + FIN_GST_RATE)) : inv.gross;
    const gst = settings.gstRegistered ? finGstOfGross(gross) : 0;
    return { ...inv, gross, gst, net: finR2(gross - gst) };
  });
}

/** Recognition date under the selected accounting basis. */
export const finRecogDate = (inv: FinInvoice, settings: FinSettings) => (settings.basis === "cash" ? inv.paid : inv.issue);

// ── BAS (quarterly) ─────────────────────────────────────────────────────
export interface Bas { quarter: Period; G1: number; A1: number; B1: number; G10: number; G11: number; W1: number; W2: number; T1: number; A5: number; gstNet: number; netPayable: number; salesCount: number; purchaseCount: number; }

export function finBAS(quarter: Period, invoices: FinInvoice[], expenses: Expense[], settings: FinSettings): Bas {
  const sales = invoices.filter((i) => finInPeriod(finRecogDate(i, settings), quarter));
  const ex = expenses.map((e) => finExpense(e, settings)).filter((e) => finInPeriod(e.date, quarter));
  const purchases = ex.filter((e) => !e.cat.wages && e.category !== "super");
  const G1 = finR2(sales.reduce((s, i) => s + i.gross, 0));
  const A1 = finR2(sales.reduce((s, i) => s + i.gst, 0));
  const G10 = finR2(purchases.filter((e) => e.capital).reduce((s, e) => s + e.gross, 0));
  const G11 = finR2(purchases.filter((e) => !e.capital).reduce((s, e) => s + e.gross, 0));
  const B1 = finR2(purchases.reduce((s, e) => s + e.gst, 0));
  const wages = ex.filter((e) => e.cat.wages);
  const W1 = finR2(wages.reduce((s, e) => s + e.gross, 0));
  const W2 = finR2(wages.reduce((s, e) => s + (e.withheld ?? 0), 0));
  const T1 = finR2(sales.reduce((s, i) => s + i.net, 0));
  const A5 = finR2(T1 * FIN_PAYGI_RATE);
  const gstNet = finR2(A1 - B1);
  return { quarter, G1, A1, B1, G10, G11, W1, W2, T1, A5, gstNet, netPayable: finR2(gstNet + W2 + A5), salesCount: sales.length, purchaseCount: purchases.length };
}

// ── profit & loss ───────────────────────────────────────────────────────
// GST-registered books report GST-exclusive figures; unregistered books
// report gross. Capital assets leave the expense set and are surfaced
// through the depreciation schedule instead.
export interface PL { income: number; incomeBy: Record<string, number>; cogs: number; cogsBy: Record<string, number>; opex: number; expBy: Record<string, number>; grossProfit: number; netProfit: number; }

export function finPL(period: Period, invoices: FinInvoice[], expenses: Expense[], settings: FinSettings): PL {
  const rec = invoices.filter((i) => finInPeriod(finRecogDate(i, settings), period));
  const ex = expenses.map((e) => finExpense(e, settings)).filter((e) => finInPeriod(e.date, period) && !e.capital);
  const incomeBy: Record<string, number> = {};
  rec.forEach((i) => { incomeBy[i.account] = finR2((incomeBy[i.account] ?? 0) + i.net); });
  const cogsBy: Record<string, number> = {};
  const expBy: Record<string, number> = {};
  ex.forEach((e) => {
    const bucket = e.cat.account.startsWith("5") ? cogsBy : expBy;
    bucket[e.cat.account] = finR2((bucket[e.cat.account] ?? 0) + e.net);
  });
  const dep = finDepreciation(expenses, settings).items
    .filter((a) => finInPeriod(a.deductionDate, period))
    .reduce((s, a) => finR2(s + a.deduction), 0);
  if (dep > 0) expBy["6-220"] = dep;
  const income = finR2(Object.values(incomeBy).reduce((s, v) => s + v, 0));
  const cogs = finR2(Object.values(cogsBy).reduce((s, v) => s + v, 0));
  const opex = finR2(Object.values(expBy).reduce((s, v) => s + v, 0));
  return { income, incomeBy, cogs, cogsBy, opex, expBy, grossProfit: finR2(income - cogs), netProfit: finR2(income - cogs - opex) };
}

// ── cash flow ───────────────────────────────────────────────────────────
/**
 * Cash that actually leaves the bank for an expense. A wage is paid net of
 * PAYG withholding: the withheld amount stays in the bank as a liability
 * (2-120) until it is remitted with the BAS. This is the same amount
 * `finLedger` credits to the bank account, so cash flow and the ledger agree.
 */
export function finCashPaid(e: Expense): number {
  return finCategory(e.category).wages ? finR2(e.gross - (e.withheld ?? 0)) : e.gross;
}
/** PAYG withheld from a wage — owed to the ATO, not yet paid out. */
const finWithheld = (e: Expense) => (finCategory(e.category).wages ? e.withheld ?? 0 : 0);

export function finCashflow(period: Period, invoices: FinInvoice[], expenses: Expense[], settings: FinSettings) {
  const rIn = (from: string, to: string) => finR2(invoices.filter((i) => i.paid && i.paid >= from && i.paid <= to).reduce((s, i) => s + i.gross, 0));
  const within = (from: string, to: string) => expenses.filter((e) => e.date >= from && e.date <= to);
  const rOut = (from: string, to: string) => finR2(within(from, to).reduce((s, e) => s + finCashPaid(e), 0));
  const opening = finR2(settings.openingBalance + rIn("2025-07-01", addDays(period.start, -1)) - rOut("2025-07-01", addDays(period.start, -1)));
  const inflow = rIn(period.start, period.end);
  const outflow = rOut(period.start, period.end);
  /** PAYG withheld from wages in the period: held in the bank, remitted separately with the BAS. */
  const withheld = finR2(within(period.start, period.end).reduce((s, e) => s + finWithheld(e), 0));
  return { opening, inflow, outflow, withheld, net: finR2(inflow - outflow), closing: finR2(opening + inflow - outflow) };
}

export function finCashToday(invoices: FinInvoice[], expenses: Expense[], settings: FinSettings) {
  const inflow = invoices.filter((i) => i.paid && i.paid <= FIN_TODAY).reduce((s, i) => s + i.gross, 0);
  const outflow = expenses.filter((e) => e.date <= FIN_TODAY).reduce((s, e) => s + finCashPaid(e), 0);
  return finR2(settings.openingBalance + inflow - outflow);
}

// ── super guarantee ─────────────────────────────────────────────────────
export function finSuper(expenses: Expense[], settings: FinSettings) {
  return FIN_PERIODS.quarters.map((q) => {
    const wages = expenses.map((e) => finExpense(e, settings)).filter((e) => e.cat.wages && finInPeriod(e.date, q));
    const otes = finR2(wages.reduce((s, e) => s + e.gross, 0));
    const sg = finR2(otes * FIN_SG_RATE);
    const paid = finR2(expenses.filter((e) => e.category === "super" && e.date > q.end && e.date <= addDays(q.end, 40)).reduce((s, e) => s + e.gross, 0));
    const status = otes === 0 ? "none" : paid >= sg ? "paid" : q.end > FIN_TODAY ? "accruing" : "due";
    return { quarter: q, otes, sg, paid, outstanding: finR2(Math.max(0, sg - paid)), status };
  });
}

// ── depreciation / instant asset write-off ──────────────────────────────
export function finDepreciation(expenses: Expense[], settings: FinSettings) {
  const items = expenses.map((e) => finExpense(e, settings)).filter((e) => e.capital).map((a) => {
    const iawo = a.net <= FIN_IAWO_THRESHOLD;
    return {
      ...a, iawo,
      treatment: iawo ? "Instant asset write-off" : "General small business pool — 15% (year 1)",
      deduction: iawo ? a.net : finR2(a.net * 0.15),
      deductionDate: iawo ? a.date : "2026-06-30",
    };
  });
  return { items, totalCost: finR2(items.reduce((s, a) => s + a.net, 0)), totalDeduction: finR2(items.reduce((s, a) => s + a.deduction, 0)) };
}

// ── general ledger (double-entry journal) ───────────────────────────────
// The journal is always kept accrual-complete; the cash/accrual setting
// governs recognition in the BAS and reports, not the record itself.
export interface JournalLine { account: string; dr: number; cr: number; }
export interface JournalEntry { date: string; ref: string; memo: string; lines: JournalLine[]; }

export function finLedger(invoices: FinInvoice[], expenses: Expense[], settings: FinSettings): JournalEntry[] {
  const entries: JournalEntry[] = [];
  invoices.forEach((i) => {
    const lines: JournalLine[] = [{ account: "1-110", dr: i.gross, cr: 0 }, { account: i.account, dr: 0, cr: i.net }];
    if (i.gst > 0) lines.push({ account: "2-100", dr: 0, cr: i.gst });
    entries.push({ date: i.issue, ref: i.number, memo: `Invoice issued — ${i.client}`, lines });
    if (i.paid) entries.push({ date: i.paid, ref: i.number, memo: `Payment received — ${i.client}`, lines: [{ account: "1-100", dr: i.gross, cr: 0 }, { account: "1-110", dr: 0, cr: i.gross }] });
  });
  expenses.map((e) => finExpense(e, settings)).forEach((e) => {
    if (e.cat.wages) {
      const wh = e.withheld ?? 0;
      entries.push({ date: e.date, ref: e.id.toUpperCase(), memo: `${e.desc} — ${e.supplier}`, lines: [
        { account: "6-200", dr: e.gross, cr: 0 },
        { account: "2-120", dr: 0, cr: wh },
        { account: "1-100", dr: 0, cr: finR2(e.gross - wh) },
      ] });
    } else {
      const lines: JournalLine[] = [{ account: e.cat.account, dr: e.net, cr: 0 }];
      if (e.gst > 0) lines.push({ account: "2-110", dr: e.gst, cr: 0 });
      lines.push({ account: "1-100", dr: 0, cr: e.gross });
      entries.push({ date: e.date, ref: e.id.toUpperCase(), memo: `${e.desc} — ${e.supplier}`, lines });
    }
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
