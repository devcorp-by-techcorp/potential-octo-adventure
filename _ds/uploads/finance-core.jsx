/* eslint-disable */
// ============================================================
// FINANCE CORE — Australian small-business bookkeeping engine
// for the studio admin portal.
//
// Standards encoded here (FY2025-26):
//   · GST 10% — tax-inclusive pricing by default; GST component of a
//     GST-inclusive amount is amount ÷ 11 (ATO method).
//   · Simpler BAS labels (G1, 1A, 1B) + PAYG withholding (W1, W2) and
//     a PAYG instalment estimate (T1 × notified rate).
//   · Australian financial year 1 July – 30 June; quarterly BAS
//     periods with statutory lodgment due dates.
//   · Super guarantee 12% of ordinary time earnings (rate from
//     1 July 2025), payable quarterly within 28 days of quarter end.
//   · Instant asset write-off threshold $20,000 per asset (small
//     business); assets over the threshold enter the general small
//     business pool (15% first-year deduction).
//   · Tax invoice content rules per ATO: the words "Tax Invoice",
//     seller identity + ABN, issue date, description, GST amount,
//     and buyer identity where total ≥ $1,000. Businesses not
//     registered for GST must issue regular invoices that do not
//     say "Tax Invoice" and must not charge GST.
//
// Settings (GST registration, price basis, cash/accrual) are user-
// selected; every calculator below branches off them so the correct
// system + templates apply on selection.
// ============================================================

const FIN_TODAY = "2026-05-14";                 // STUDIO_TODAY reference
const FIN_GST_RATE = 0.10;
const FIN_SG_RATE = 0.12;                        // super guarantee FY2025-26
const FIN_PAYGI_RATE = 0.045;                    // ATO-notified instalment rate (seeded)
const FIN_IAWO_THRESHOLD = 20000;                // instant asset write-off, per asset

// --- money helpers -------------------------------------------
const finR2 = (n) => Math.round(n * 100) / 100;
const finAUD = (n) => "$" + (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const finAUD0 = (n) => "$" + Math.round(n).toLocaleString("en-AU");
const finGstOfGross = (gross) => finR2(gross / 11); // GST component of a GST-inclusive amount

function finAddDays(iso, days) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function finMinIso(a, b) { return a < b ? a : b; }
function finFmt(iso, opts) { return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", opts || { day: "2-digit", month: "short", year: "2-digit" }); }

// --- periods: FY 2025-26, quarters, months -------------------
function finBuildPeriods() {
  const fy = { key: "fy", label: "FY 2025–26", start: "2025-07-01", end: "2026-06-30", kind: "fy" };
  const quarters = [
    { key: "q1", label: "Q1 · Jul–Sep 2025", start: "2025-07-01", end: "2025-09-30", due: "2025-10-28", superDue: "2025-10-28", kind: "quarter" },
    { key: "q2", label: "Q2 · Oct–Dec 2025", start: "2025-10-01", end: "2025-12-31", due: "2026-02-28", superDue: "2026-01-28", kind: "quarter" },
    { key: "q3", label: "Q3 · Jan–Mar 2026", start: "2026-01-01", end: "2026-03-31", due: "2026-04-28", superDue: "2026-04-28", kind: "quarter" },
    { key: "q4", label: "Q4 · Apr–Jun 2026", start: "2026-04-01", end: "2026-06-30", due: "2026-07-28", superDue: "2026-07-28", kind: "quarter" },
  ];
  const months = [];
  for (let i = 0; i < 12; i++) {
    const y = i < 6 ? 2025 : 2026, m = ((6 + i) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    const last = new Date(y, m, 0).getDate();
    months.push({ key: `m-${y}-${mm}`, label: new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" }), start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}`, kind: "month" });
  }
  return { fy, quarters, months, all: [fy, ...quarters, ...months] };
}
const FIN_PERIODS = finBuildPeriods();
const finPeriod = (key) => FIN_PERIODS.all.find((p) => p.key === key) || FIN_PERIODS.fy;
const finInPeriod = (iso, p) => !!iso && iso >= p.start && iso <= p.end;
const FIN_CURRENT_QUARTER = FIN_PERIODS.quarters.find((q) => finInPeriod(FIN_TODAY, q)) || FIN_PERIODS.quarters[3];

// --- settings (user-selected; drives systems + templates) ----
const FIN_SETTINGS_DEFAULT = {
  gstRegistered: true,          // manual selection — GST system + tax-invoice template on/off
  priceBasis: "inclusive",      // "inclusive" | "exclusive" — how package prices are quoted
  basis: "cash",                // "cash" | "accrual" — recognition method
  openingBalance: 18450,        // bank balance at 1 July 2025
};
function finGetSettings() {
  try { return { ...FIN_SETTINGS_DEFAULT, ...(JSON.parse(localStorage.getItem("is_fin_settings") || "{}")) }; }
  catch (e) { return { ...FIN_SETTINGS_DEFAULT }; }
}
function finSetSettings(patch) {
  const next = { ...finGetSettings(), ...patch };
  localStorage.setItem("is_fin_settings", JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("fin-settings", { detail: next }));
  return next;
}
function useFinSettings() {
  const [settings, setState] = React.useState(finGetSettings);
  React.useEffect(() => {
    const h = (e) => setState(e.detail || finGetSettings());
    window.addEventListener("fin-settings", h);
    return () => window.removeEventListener("fin-settings", h);
  }, []);
  return [settings, (patch) => finSetSettings(patch)];
}

// --- chart of accounts ---------------------------------------
const FIN_COA = [
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
const finAccount = (code) => FIN_COA.find((a) => a.code === code) || { code, name: code, type: "" };

// --- expense categories (ATO-aligned, GST treatment encoded) --
// gst:false = no input tax credit (wages/super are not purchases;
// bank fees are input-taxed financial supplies).
const FIN_EXPENSE_CATEGORIES = [
  { key: "advertising",  label: "Advertising & Marketing",          account: "6-100", gst: true },
  { key: "motor",        label: "Motor Vehicle & Travel",           account: "6-110", gst: true },
  { key: "insurance",    label: "Business Insurance",               account: "6-120", gst: true },
  { key: "rent",         label: "Rent & Studio Hire",               account: "6-130", gst: true },
  { key: "equipment",    label: "Equipment & Fit-out (capital)",    account: "1-210", gst: true, capital: true },
  { key: "software",     label: "Software & Subscriptions",         account: "6-140", gst: true },
  { key: "phone",        label: "Phone & Internet",                 account: "6-150", gst: true },
  { key: "professional", label: "Accounting & Professional Fees",   account: "6-160", gst: true },
  { key: "contractors",  label: "Contractors & Second Shooters",    account: "5-100", gst: true },
  { key: "printing",     label: "Printing & Album Production",      account: "5-110", gst: true },
  { key: "wages",        label: "Wages & Salaries",                 account: "6-200", gst: false, wages: true },
  { key: "super",        label: "Superannuation",                   account: "6-210", gst: false },
  { key: "training",     label: "Training & Development",           account: "6-170", gst: true },
  { key: "consumables",  label: "Studio Consumables & Props",       account: "6-180", gst: true },
  { key: "bank",         label: "Bank Fees & Charges",              account: "6-190", gst: false },
];
const finCategory = (key) => FIN_EXPENSE_CATEGORIES.find((c) => c.key === key) || FIN_EXPENSE_CATEGORIES[0];

// Computed view of a stored expense under current settings.
function finExpense(e, settings) {
  const cat = finCategory(e.category);
  const gst = settings.gstRegistered && cat.gst ? finGstOfGross(e.gross) : 0;
  return { ...e, cat, gst, net: finR2(e.gross - gst), capital: !!cat.capital };
}

// --- seeded expenses (FY to date) -----------------------------
function finSeedExpenses() {
  const rows = [];
  const ym = FIN_PERIODS.months.map((m) => m.start.slice(0, 7));
  ym.forEach((m) => {
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

// --- seeded prior-season invoices (all settled) ---------------
const FIN_INVOICES_SEED = [
  { n: 1001, date: "2025-07-18", client: "Nguyen Family", desc: "Family portrait session — Carlton Gardens", account: "4-110", gross: 1450 },
  { n: 1002, date: "2025-08-02", client: "Patel · Anika & Dev", desc: "Wedding photography — Signature collection", account: "4-100", gross: 5800 },
  { n: 1003, date: "2025-08-23", client: "Reyes · Camila", desc: "Personal branding portrait session", account: "4-110", gross: 3200 },
  { n: 1004, date: "2025-09-12", client: "O'Connell · Saoirse & Finn", desc: "Wedding photography — Atelier collection", account: "4-100", gross: 7800 },
  { n: 1005, date: "2025-10-04", client: "Tan · Wei & Jasmine", desc: "Engagement session — Brighton bathing boxes", account: "4-100", gross: 1650 },
  { n: 1006, date: "2025-10-25", client: "Kowalski · Lena & Tomas", desc: "Wedding photography — Signature collection", account: "4-100", gross: 5800 },
  { n: 1007, date: "2025-11-15", client: "Abadi Studio", desc: "Editorial commission — lookbook", account: "4-120", gross: 4600 },
  { n: 1008, date: "2025-12-06", client: "Fitzgerald · Grace & Henry", desc: "Wedding photography — Atelier collection", account: "4-100", gross: 9200 },
  { n: 1009, date: "2026-01-17", client: "Marsh · Olivia", desc: "Portrait session — studio", account: "4-110", gross: 3200 },
  { n: 1010, date: "2026-02-07", client: "Silva · Isabela & Rafael", desc: "Wedding photography — Signature collection", account: "4-100", gross: 5800 },
  { n: 1011, date: "2026-02-28", client: "Hart Family", desc: "Family session — golden hour", account: "4-110", gross: 1450 },
  { n: 1012, date: "2026-03-14", client: "Beaumont & Co", desc: "Editorial commission — press feature", account: "4-120", gross: 4600 },
  { n: 1013, date: "2026-04-11", client: "Ibrahim · Layla", desc: "Portrait session — studio", account: "4-110", gross: 3200 },
  { n: 1014, date: "2026-04-25", client: "Lowe · Prudence", desc: "Fine-art album & print order", account: "4-130", gross: 1120 },
];

const FIN_EVENT_ACCOUNT = { Wedding: "4-100", Engagement: "4-100", Portrait: "4-110", Family: "4-110", Editorial: "4-120", Commercial: "4-120" };

// --- invoice assembly -----------------------------------------
// Booking-derived invoices mirror deriveBooking (booking.jsx):
// retainer 30% raised at phase ≥ 2 (paid ≥ 3), final balance raised
// at phase ≥ 4 (paid ≥ 6); explicit depositPaid / balancePaid
// flags (Mark-Paid actions) override the phase-derived state.
function finBookingRef(id) { return "IS-26-" + String(parseInt(String(id).replace(/\D/g, ""), 10) || 0).padStart(3, "0"); }

function finGrossFromValue(value, settings) {
  return settings.gstRegistered && settings.priceBasis === "exclusive" ? finR2(value * 1.1) : value;
}

function finInvoicesFromBookings(bookings, settings) {
  const out = [];
  bookings.forEach((b) => {
    const gross = finGrossFromValue(b.value, settings);
    const depositGross = finR2(Math.round(gross * 0.3));
    const ref = finBookingRef(b.id);
    const name = b.clientName.includes("·") ? b.clientName.split("·").slice(1).join("·").trim() : b.clientName;
    if (b.phase >= 2) {
      const issue = finMinIso(finAddDays(b.date, -75), finAddDays(FIN_TODAY, -7));
      const paid = b.depositPaid != null ? b.depositPaid : b.phase >= 3;
      out.push({
        id: `inv-${b.id}-r`, number: `INV-${ref}-R`, source: "derived", bookingId: b.id, clientName: name,
        desc: `Booking retainer (30%) — ${b.eventType}, ${finFmt(b.date, { day: "numeric", month: "long", year: "numeric" })}`,
        account: FIN_EVENT_ACCOUNT[b.eventType] || "4-110",
        issueDate: issue, dueDate: finAddDays(issue, 14), gross: depositGross,
        paidDate: paid ? finMinIso(finAddDays(issue, 7), FIN_TODAY) : null,
      });
    }
    if (b.phase >= 4) {
      const issue = finMinIso(finAddDays(b.date, -14), finAddDays(FIN_TODAY, -3));
      const paid = b.balancePaid != null ? b.balancePaid : b.phase >= 6;
      out.push({
        id: `inv-${b.id}-f`, number: `INV-${ref}-F`, source: "derived", bookingId: b.id, clientName: name,
        desc: `Final balance — ${b.eventType}, ${finFmt(b.date, { day: "numeric", month: "long", year: "numeric" })}`,
        account: FIN_EVENT_ACCOUNT[b.eventType] || "4-110",
        issueDate: issue, dueDate: finAddDays(issue, 14), gross: finR2(gross - depositGross),
        paidDate: paid ? finMinIso(finAddDays(issue, 7), finAddDays(FIN_TODAY, -1)) : null,
      });
    }
  });
  return out;
}

function finSeedInvoices() {
  return FIN_INVOICES_SEED.map((s) => ({
    id: `inv-seed-${s.n}`, number: `INV-${s.n}`, source: "seed", bookingId: null, clientName: s.client,
    desc: s.desc, account: s.account, issueDate: s.date, dueDate: finAddDays(s.date, 14),
    gross: s.gross, paidDate: finAddDays(s.date, 7),
  }));
}

// Merge derived + seed + manual, apply user overrides, compute
// GST + status under current settings.
function finAllInvoices(bookings, manual, overrides, settings) {
  const base = [...finSeedInvoices(), ...finInvoicesFromBookings(bookings, settings), ...(manual || [])];
  return base.map((inv) => {
    const o = (overrides || {})[inv.id] || {};
    const paidDate = o.paidDate !== undefined ? o.paidDate : inv.paidDate;
    const gst = settings.gstRegistered ? finGstOfGross(inv.gross) : 0;
    const status = paidDate ? "paid" : (inv.dueDate < FIN_TODAY ? "overdue" : "due");
    return { ...inv, ...o, paidDate, gst, net: finR2(inv.gross - gst), status };
  }).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

// Recognition date under the selected accounting basis.
const finRecogDate = (inv, settings) => settings.basis === "cash" ? inv.paidDate : inv.issueDate;

// --- BAS (quarterly) ------------------------------------------
function finBAS(quarter, invoices, expenses, settings) {
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
  const W2 = finR2(wages.reduce((s, e) => s + (e.withheld || 0), 0));
  const T1 = finR2(sales.reduce((s, i) => s + i.net, 0));
  const A5 = finR2(T1 * FIN_PAYGI_RATE);
  const gstNet = finR2(A1 - B1);
  return { quarter, G1, A1, B1, G10, G11, W1, W2, T1, A5, gstNet, netPayable: finR2(gstNet + W2 + A5), salesCount: sales.length, purchaseCount: purchases.length };
}

// --- P&L -------------------------------------------------------
// GST-registered books report GST-exclusive figures; unregistered
// books report gross. Capital assets are excluded from expenses and
// surfaced through the depreciation schedule instead.
function finPL(period, invoices, expenses, settings) {
  const rec = invoices.filter((i) => finInPeriod(finRecogDate(i, settings), period));
  const ex = expenses.map((e) => finExpense(e, settings)).filter((e) => finInPeriod(e.date, period) && !e.capital);
  const incomeBy = {};
  rec.forEach((i) => { incomeBy[i.account] = finR2((incomeBy[i.account] || 0) + i.net); });
  const cogsBy = {}, expBy = {};
  ex.forEach((e) => {
    const bucket = e.cat.account.startsWith("5") ? cogsBy : expBy;
    bucket[e.cat.account] = finR2((bucket[e.cat.account] || 0) + e.net);
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

// --- cash flow -------------------------------------------------
function finCashflow(period, invoices, expenses, settings) {
  const rIn = (from, to) => finR2(invoices.filter((i) => i.paidDate && i.paidDate >= from && i.paidDate <= to).reduce((s, i) => s + i.gross, 0));
  const rOut = (from, to) => finR2(expenses.filter((e) => e.date >= from && e.date <= to).reduce((s, e) => s + e.gross, 0));
  const opening = finR2(FIN_SETTINGS_DEFAULT.openingBalance + rIn("2025-07-01", finAddDays(period.start, -1)) - rOut("2025-07-01", finAddDays(period.start, -1)));
  const inflow = rIn(period.start, period.end), outflow = rOut(period.start, period.end);
  return { opening, inflow, outflow, net: finR2(inflow - outflow), closing: finR2(opening + inflow - outflow) };
}
function finCashToday(invoices, expenses) {
  const inflow = invoices.filter((i) => i.paidDate && i.paidDate <= FIN_TODAY).reduce((s, i) => s + i.gross, 0);
  const outflow = expenses.filter((e) => e.date <= FIN_TODAY).reduce((s, e) => s + e.gross, 0);
  return finR2(FIN_SETTINGS_DEFAULT.openingBalance + inflow - outflow);
}

// --- super guarantee -------------------------------------------
function finSuper(expenses, settings) {
  return FIN_PERIODS.quarters.map((q) => {
    const wages = expenses.map((e) => finExpense(e, settings)).filter((e) => e.cat.wages && finInPeriod(e.date, q));
    const otes = finR2(wages.reduce((s, e) => s + e.gross, 0));
    const sg = finR2(otes * FIN_SG_RATE);
    const paid = finR2(expenses.filter((e) => e.category === "super" && e.date > q.end && e.date <= finAddDays(q.end, 40)).reduce((s, e) => s + e.gross, 0));
    return { quarter: q, otes, sg, paid, outstanding: finR2(Math.max(0, sg - paid)), status: otes === 0 ? "none" : paid >= sg ? "paid" : q.end > FIN_TODAY ? "accruing" : "due" };
  });
}

// --- depreciation / instant asset write-off --------------------
function finDepreciation(expenses, settings) {
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

// --- general ledger (double-entry journal) ---------------------
// The journal is always kept accrual-complete; the cash/accrual
// setting governs recognition in the BAS + reports, not the record.
function finLedger(invoices, expenses, settings) {
  const entries = [];
  invoices.forEach((i) => {
    const lines = [{ account: "1-110", dr: i.gross, cr: 0 }, { account: i.account, dr: 0, cr: i.net }];
    if (i.gst > 0) lines.push({ account: "2-100", dr: 0, cr: i.gst });
    entries.push({ date: i.issueDate, ref: i.number, memo: `Invoice issued — ${i.clientName}`, lines });
    if (i.paidDate) entries.push({ date: i.paidDate, ref: i.number, memo: `Payment received — ${i.clientName}`, lines: [{ account: "1-100", dr: i.gross, cr: 0 }, { account: "1-110", dr: 0, cr: i.gross }] });
  });
  expenses.map((e) => finExpense(e, settings)).forEach((e) => {
    if (e.cat.wages) {
      const wh = e.withheld || 0;
      entries.push({ date: e.date, ref: e.id.toUpperCase(), memo: `${e.desc} — ${e.supplier}`, lines: [
        { account: "6-200", dr: e.gross, cr: 0 },
        { account: "2-120", dr: 0, cr: wh },
        { account: "1-100", dr: 0, cr: finR2(e.gross - wh) },
      ]});
    } else {
      const lines = [{ account: e.cat.account, dr: e.net, cr: 0 }];
      if (e.gst > 0) lines.push({ account: "2-110", dr: e.gst, cr: 0 });
      lines.push({ account: "1-100", dr: 0, cr: e.gross });
      entries.push({ date: e.date, ref: e.id.toUpperCase(), memo: `${e.desc} — ${e.supplier}`, lines });
    }
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

Object.assign(window, {
  FIN_TODAY, FIN_GST_RATE, FIN_SG_RATE, FIN_PAYGI_RATE, FIN_IAWO_THRESHOLD,
  FIN_PERIODS, FIN_CURRENT_QUARTER, FIN_COA, FIN_EXPENSE_CATEGORIES, FIN_INVOICES_SEED,
  finR2, finAUD, finAUD0, finGstOfGross, finAddDays, finFmt, finPeriod, finInPeriod,
  finGetSettings, finSetSettings, useFinSettings, finAccount, finCategory, finExpense,
  finSeedExpenses, finInvoicesFromBookings, finSeedInvoices, finAllInvoices, finRecogDate,
  finBAS, finPL, finCashflow, finCashToday, finSuper, finDepreciation, finLedger, finBookingRef,
});
