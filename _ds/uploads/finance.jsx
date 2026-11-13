/* eslint-disable */
// ============================================================
// ADMIN FINANCE — shell, settings strip, Overview + Invoices.
// Calculations live in finance-core.jsx; the remaining tabs
// (Expenses / GST & BAS / Reports / Accounts) in finance-tabs.jsx.
// ============================================================

const finShellStyles = {
  th: {
    display: "grid", padding: "14px 20px", background: "var(--ink-100)",
    fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase",
    color: "var(--bone-300)", fontWeight: 500,
    border: "1px solid var(--ink-400)", borderBottom: "none",
  },
  tr: {
    display: "grid", padding: "14px 20px", background: "var(--ink-100)",
    alignItems: "center", transition: "background 200ms",
  },
  num: { fontFeatureSettings: '"tnum","lnum"', fontFamily: "var(--font-body)", fontSize: 13 },
};

// Right-aligned tabular money cell.
const FinMoney = ({ v, dim, gold, strong }) =>
<div className="numeric" style={{
  textAlign: "right", fontSize: 13,
  color: gold ? "var(--gold-200)" : dim ? "var(--bone-400)" : "var(--bone-100)",
  fontWeight: strong ? 600 : 400
}}>{finAUD(v)}</div>;

const FinTabBtn = ({ label, active, onClick }) =>
<button onClick={onClick} style={{
  padding: "12px 18px", marginBottom: -1,
  color: active ? "var(--gold-100)" : "var(--bone-300)",
  borderBottom: `1px solid ${active ? "var(--gold-300)" : "transparent"}`,
  fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 500
}}>{label}</button>;

const FinField = ({ label, children, span }) =>
<label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span className="field-label">{label}</span>
    {children}
  </label>;

const FinStatusBadge = ({ status }) => {
  const cls = { paid: "badge badge-success", due: "badge badge-info", overdue: "badge badge-gold", draft: "badge badge-muted" }[status] || "badge badge-muted";
  return <span className={cls}>{status}</span>;
};

// --- Settings strip: the manual selections that switch the ----
// --- active system + templates (GST / pricing / basis) --------
const FinSettingsBar = ({ settings, setSettings, periodKey, setPeriodKey }) => {
  const sel = { width: "auto", padding: "8px 32px 8px 12px", fontSize: 12, background: "var(--ink-100)" };
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16,
      padding: "16px 20px", margin: "28px 0 0",
      background: "var(--ink-100)", border: "1px solid var(--ink-400)"
    }}>
      <FinField label="Reporting Period">
        <select className="select" style={sel} value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
          <optgroup label="Financial year">
            <option value="fy">{FIN_PERIODS.fy.label}</option>
          </optgroup>
          <optgroup label="BAS quarters">
            {FIN_PERIODS.quarters.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
          </optgroup>
          <optgroup label="Months">
            {FIN_PERIODS.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </optgroup>
        </select>
      </FinField>
      <FinField label="GST Registration">
        <select className="select" style={sel} value={settings.gstRegistered ? "yes" : "no"}
          onChange={(e) => setSettings({ gstRegistered: e.target.value === "yes" })}>
          <option value="yes">Registered — GST 10%</option>
          <option value="no">Not registered</option>
        </select>
      </FinField>
      {settings.gstRegistered &&
      <FinField label="Package Pricing">
          <select className="select" style={sel} value={settings.priceBasis}
          onChange={(e) => setSettings({ priceBasis: e.target.value })}>
            <option value="inclusive">GST-inclusive</option>
            <option value="exclusive">GST-exclusive (+10%)</option>
          </select>
        </FinField>
      }
      <FinField label="Accounting Basis">
        <select className="select" style={sel} value={settings.basis}
          onChange={(e) => setSettings({ basis: e.target.value })}>
          <option value="cash">Cash basis</option>
          <option value="accrual">Accrual basis</option>
        </select>
      </FinField>
      <div style={{ flex: 1 }}></div>
      <div style={{ fontSize: 11, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", paddingBottom: 6, textAlign: "right" }}>
        {settings.basis === "cash" ? "Income & GST recognised when money is received or paid." : "Income & GST recognised when invoices are issued."}
      </div>
    </div>);
};

// ============================================================
// SHELL
// ============================================================
const AdminFinance = ({ bookings, contacts }) => {
  const [settings, setSettings] = useFinSettings();
  const [tab, setTab] = useState("overview");
  const [periodKey, setPeriodKey] = useState(() => localStorage.getItem("is_fin_period") || FIN_CURRENT_QUARTER.key);
  const [expenses, setExpenses] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("is_fin_expenses") || "null");
    return stored && stored.length ? stored : finSeedExpenses();
  });
  const [manualInv, setManualInv] = useState(() => JSON.parse(localStorage.getItem("is_fin_invoices_manual") || "null") || []);
  const [overrides, setOverrides] = useState(() => JSON.parse(localStorage.getItem("is_fin_inv_overrides") || "null") || {});

  useEffect(() => { localStorage.setItem("is_fin_period", periodKey); }, [periodKey]);
  useEffect(() => { localStorage.setItem("is_fin_expenses", JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem("is_fin_invoices_manual", JSON.stringify(manualInv)); }, [manualInv]);
  useEffect(() => { localStorage.setItem("is_fin_inv_overrides", JSON.stringify(overrides)); }, [overrides]);

  const period = finPeriod(periodKey);
  const invoices = useMemo(() => finAllInvoices(bookings, manualInv, overrides, settings), [bookings, manualInv, overrides, settings]);
  const setInvoicePaid = (id, paid) => setOverrides((o) => ({ ...o, [id]: { ...(o[id] || {}), paidDate: paid ? FIN_TODAY : null } }));

  const shared = { settings, setSettings, period, invoices, expenses, setExpenses, contacts, manualInv, setManualInv, setInvoicePaid };

  return (
    <div className="fade-in">
      <SectionHeader
        eyebrow="— Business Finance"
        title="Finance"
        subtitle="Bookkeeping, invoicing and activity statements — kept to Australian requirements." />

      <FinSettingsBar settings={settings} setSettings={setSettings} periodKey={periodKey} setPeriodKey={setPeriodKey} />

      <div style={{ display: "flex", gap: 4, margin: "24px 0 28px", borderBottom: "1px solid var(--ink-400)", flexWrap: "wrap" }}>
        <FinTabBtn label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
        <FinTabBtn label="Invoices" active={tab === "invoices"} onClick={() => setTab("invoices")} />
        <FinTabBtn label="Expenses" active={tab === "expenses"} onClick={() => setTab("expenses")} />
        <FinTabBtn label="GST & BAS" active={tab === "bas"} onClick={() => setTab("bas")} />
        <FinTabBtn label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} />
        <FinTabBtn label="Accounts" active={tab === "accounts"} onClick={() => setTab("accounts")} />
      </div>

      {tab === "overview" && <FinOverview {...shared} setTab={setTab} />}
      {tab === "invoices" && <FinInvoices {...shared} />}
      {tab === "expenses" && <window.FinExpenses {...shared} />}
      {tab === "bas" && <window.FinBas {...shared} />}
      {tab === "reports" && <window.FinReports {...shared} />}
      {tab === "accounts" && <window.FinAccounts {...shared} />}
    </div>);
};

// ============================================================
// OVERVIEW
// ============================================================
const FinOverview = ({ settings, period, invoices, expenses, setTab }) => {
  const pl = finPL(period, invoices, expenses, settings);
  const cf = finCashflow(period, invoices, expenses, settings);
  const cashToday = finCashToday(invoices, expenses);
  const bas = finBAS(FIN_CURRENT_QUARTER, invoices, expenses, settings);
  const sg = finSuper(expenses, settings).find((s) => s.quarter.key === FIN_CURRENT_QUARTER.key);
  const overdue = invoices.filter((i) => i.status === "overdue");
  const fyIncome = finPL(FIN_PERIODS.fy, invoices, expenses, settings).income;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        <KpiCard label={`Income · ${period.kind === "fy" ? "FY" : period.label.split(" ·")[0]}`} value={finAUD0(pl.income)} hint={settings.gstRegistered ? "GST-exclusive · " + settings.basis : "gross · " + settings.basis} />
        <KpiCard label="Expenses" value={finAUD0(pl.cogs + pl.opex)} hint="incl. cost of sales" />
        <KpiCard label="Net Profit" value={finAUD0(pl.netProfit)} hint={pl.netProfit >= 0 ? "before income tax" : "operating loss"} accent />
        <KpiCard label="Cash at Bank" value={finAUD0(cashToday)} hint={`as at ${finFmt(FIN_TODAY, { day: "numeric", month: "long" })}`} />
      </div>

      <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
        {/* P&L snapshot */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div className="label-sm">Profit &amp; Loss · {period.label}</div>
            <button onClick={() => setTab("reports")} style={{ fontSize: 11, color: "var(--gold-200)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Full report</button>
          </div>
          <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "8px 24px" }}>
            <FinPlRow label="Income" v={pl.income} />
            <FinPlRow label="Cost of sales" v={-pl.cogs} />
            <FinPlRow label="Gross profit" v={pl.grossProfit} strong />
            <FinPlRow label="Operating expenses" v={-pl.opex} />
            <FinPlRow label="Net profit" v={pl.netProfit} strong gold last />
          </div>

          <div className="label-sm" style={{ margin: "32px 0 20px" }}>Cash Movement · {period.label}</div>
          <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "8px 24px" }}>
            <FinPlRow label="Opening balance" v={cf.opening} />
            <FinPlRow label="Receipts" v={cf.inflow} />
            <FinPlRow label="Payments" v={-cf.outflow} />
            <FinPlRow label="Closing balance" v={cf.closing} strong gold last />
          </div>
        </div>

        {/* Obligations */}
        <div>
          <div className="label-sm" style={{ marginBottom: 20 }}>Upcoming Obligations</div>
          <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 24, display: "flex", flexDirection: "column", gap: 0 }}>
            {settings.gstRegistered ?
            <FinObligation
              title={`BAS · ${FIN_CURRENT_QUARTER.label}`}
              due={FIN_CURRENT_QUARTER.due}
              amount={bas.netPayable}
              note={`GST ${finAUD(bas.gstNet)} · PAYG W ${finAUD(bas.W2)} · instalment ${finAUD(bas.A5)}`}
              onClick={() => setTab("bas")} /> :

            <FinObligation
              title="GST registration"
              due={null}
              amount={null}
              note={fyIncome >= 75000 ?
              `FY turnover ${finAUD0(fyIncome)} has reached the $75,000 threshold — registration is required.` :
              `Not registered. FY turnover ${finAUD0(fyIncome)} of the $75,000 registration threshold.`}
              alert={fyIncome >= 75000} />
            }
            {sg && sg.otes > 0 &&
            <FinObligation
              title={`Super guarantee · ${sg.quarter.label.split(" · ")[0]}`}
              due={sg.quarter.superDue}
              amount={sg.sg}
              note={`${(FIN_SG_RATE * 100).toFixed(0)}% of ${finAUD(sg.otes)} wages · ${sg.status}`}
              onClick={() => setTab("reports")} />
            }
            {overdue.length > 0 &&
            <FinObligation
              title={`${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""}`}
              due={null}
              amount={overdue.reduce((s, i) => s + i.gross, 0)}
              note={overdue.slice(0, 2).map((i) => i.number).join(" · ")}
              alert
              onClick={() => setTab("invoices")} />
            }
            <div style={{ paddingTop: 16, fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              Figures are prepared on the {settings.basis} basis{settings.gstRegistered ? ", GST-registered" : ", no GST registration"}. Confirm with your registered tax or BAS agent before lodging.
            </div>
          </div>
        </div>
      </div>
    </div>);
};

const FinPlRow = ({ label, v, strong, gold, last }) =>
<div style={{
  display: "flex", justifyContent: "space-between", alignItems: "baseline",
  padding: "13px 0", borderBottom: last ? "none" : "1px solid var(--ink-300)"
}}>
    <div style={{ fontSize: strong ? 12 : 13, color: strong ? "var(--bone-100)" : "var(--bone-300)", fontFamily: "var(--font-body)", letterSpacing: strong ? "0.14em" : "0.02em", textTransform: strong ? "uppercase" : "none", fontWeight: strong ? 600 : 400 }}>
      {label}
    </div>
    <div className="numeric" style={{ fontSize: strong ? 16 : 13, fontFamily: strong ? "var(--font-display)" : "var(--font-body)", color: gold ? "var(--gold-200)" : v < 0 ? "var(--bone-300)" : "var(--bone-100)" }}>
      {v < 0 ? `(${finAUD(Math.abs(v))})` : finAUD(v)}
    </div>
  </div>;

const FinObligation = ({ title, due, amount, note, alert, onClick }) =>
<div onClick={onClick} style={{
  display: "grid", gridTemplateColumns: "1fr auto", gap: 4,
  padding: "14px 0", borderBottom: "1px solid var(--ink-300)",
  cursor: onClick ? "pointer" : "default"
}}>
    <div>
      <div style={{ fontSize: 13, color: alert ? "var(--gold-100)" : "var(--bone-100)", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 3 }}>{note}</div>
    </div>
    <div style={{ textAlign: "right" }}>
      {amount != null && <div className="numeric" style={{ fontSize: 15, color: "var(--gold-200)", fontFamily: "var(--font-display)" }}>{finAUD(amount)}</div>}
      {due && <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--bone-400)", marginTop: 3 }}>due {finFmt(due)}</div>}
    </div>
  </div>;

// ============================================================
// INVOICES
// ============================================================
const FinInvoices = ({ settings, invoices, contacts, manualInv, setManualInv, setInvoicePaid }) => {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const filtered = invoices.filter((i) => filter === "all" ? true : i.status === filter);
  const open = invoices.find((i) => i.id === openId);
  const cols = settings.gstRegistered ? "1.1fr 1.4fr 0.8fr 0.8fr 0.9fr 0.7fr 0.7fr" : "1.1fr 1.6fr 0.8fr 0.8fr 0.9fr 0.7fr";

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--ink-400)", alignItems: "center" }}>
        <FilterTab label="All" count={invoices.length} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterTab label="Paid" count={invoices.filter((i) => i.status === "paid").length} active={filter === "paid"} onClick={() => setFilter("paid")} />
        <FilterTab label="Due" count={invoices.filter((i) => i.status === "due").length} active={filter === "due"} onClick={() => setFilter("due")} />
        <FilterTab label="Overdue" count={invoices.filter((i) => i.status === "overdue").length} active={filter === "overdue"} onClick={() => setFilter("overdue")} />
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-primary btn-sm" style={{ marginBottom: 8 }} onClick={() => setCreating((c) => !c)}>
          <Icon name="plus" size={12} /> New Invoice
        </button>
      </div>

      {creating && <FinInvoiceForm settings={settings} contacts={contacts} manualInv={manualInv} setManualInv={setManualInv} onDone={() => setCreating(false)} />}

      <div style={{ ...finShellStyles.th, gridTemplateColumns: cols }}>
        <div>Invoice</div><div>Client</div><div>Issued</div><div>Due</div>
        <div style={{ textAlign: "right" }}>Total</div>
        {settings.gstRegistered && <div style={{ textAlign: "right" }}>GST</div>}
        <div style={{ textAlign: "right" }}>Status</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--ink-400)", border: "1px solid var(--ink-400)", borderTop: "none" }}>
        {filtered.map((inv) =>
        <div key={inv.id} onClick={() => setOpenId(inv.id)}
        style={{ ...finShellStyles.tr, gridTemplateColumns: cols, cursor: "pointer" }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--ink-200)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "var(--ink-100)"}>
            <div className="numeric" style={{ fontSize: 12, letterSpacing: "0.08em", color: "var(--gold-200)" }}>{inv.number}</div>
            <div>
              <div style={{ fontSize: 13, color: "var(--bone-100)", fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>{inv.clientName}</div>
              <div style={{ fontSize: 11, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inv.desc}</div>
            </div>
            <div className="numeric" style={{ fontSize: 12, color: "var(--bone-300)" }}>{finFmt(inv.issueDate)}</div>
            <div className="numeric" style={{ fontSize: 12, color: inv.status === "overdue" ? "var(--gold-200)" : "var(--bone-300)" }}>{finFmt(inv.dueDate)}</div>
            <FinMoney v={inv.gross} />
            {settings.gstRegistered && <FinMoney v={inv.gst} dim />}
            <div style={{ textAlign: "right" }}><FinStatusBadge status={inv.status} /></div>
          </div>
        )}
        {filtered.length === 0 &&
        <div style={{ background: "var(--ink-100)", padding: "28px 24px", fontSize: 13, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            No invoices in this state.
          </div>
        }
      </div>

      {open && <FinInvoiceDrawer inv={open} settings={settings} onClose={() => setOpenId(null)} setInvoicePaid={setInvoicePaid} />}
    </div>);
};

// --- manual invoice entry -------------------------------------
const FinInvoiceForm = ({ settings, contacts, manualInv, setManualInv, onDone }) => {
  const toast = useToast();
  const [f, setF] = useState({ clientName: "", desc: "", account: "4-100", gross: "", issueDate: FIN_TODAY, terms: 14 });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const gross = parseFloat(f.gross) || 0;

  const save = () => {
    if (!f.clientName.trim() || gross <= 0) { toast("A client name and an amount are required"); return; }
    const number = "INV-" + (2001 + manualInv.length);
    setManualInv((m) => [...m, {
      id: "inv-man-" + Date.now(), number, source: "manual", bookingId: null,
      clientName: f.clientName.trim(), desc: f.desc.trim() || "Photography services",
      account: f.account, issueDate: f.issueDate, dueDate: finAddDays(f.issueDate, Number(f.terms)),
      gross: finR2(gross), paidDate: null,
    }]);
    toast(`${number} raised for ${f.clientName.trim()}`);
    onDone();
  };

  return (
    <div style={{ background: "var(--ink-100)", border: "1px solid var(--gold-400)", padding: 24, marginBottom: 24 }}>
      <div className="label-sm" style={{ marginBottom: 18 }}>Raise Invoice</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
        <FinField label="Client" span={2}>
          <input className="input" list="fin-contacts" value={f.clientName} onChange={set("clientName")} placeholder="Client or company name" />
          <datalist id="fin-contacts">{contacts.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </FinField>
        <FinField label="Description" span={2}>
          <input className="input" value={f.desc} onChange={set("desc")} placeholder="e.g. Portrait session — studio" />
        </FinField>
        <FinField label="Income Account" span={2}>
          <select className="select" value={f.account} onChange={set("account")}>
            {FIN_COA.filter((a) => a.type === "Income").map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
          </select>
        </FinField>
        <FinField label={settings.gstRegistered ? "Total (incl. GST) $" : "Total $"} span={2}>
          <input className="input numeric" type="number" min="0" step="0.01" value={f.gross} onChange={set("gross")} placeholder="0.00" />
        </FinField>
        <FinField label="Issue Date" span={2}>
          <input className="input numeric" type="date" value={f.issueDate} onChange={set("issueDate")} />
        </FinField>
        <FinField label="Payment Terms" span={2}>
          <select className="select" value={f.terms} onChange={set("terms")}>
            <option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
        </FinField>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
        <button className="btn btn-primary btn-sm" onClick={save}>Raise Invoice</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
        {settings.gstRegistered && gross > 0 &&
        <span style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Includes GST of {finAUD(finGstOfGross(gross))}
          </span>
        }
      </div>
    </div>);
};

// --- invoice drawer with ATO-format paper preview -------------
const FinInvoiceDrawer = ({ inv, settings, onClose, setInvoicePaid }) => {
  const toast = useToast();
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, []);
  const s = window.STUDIO_PROFILE;
  const isTax = settings.gstRegistered;

  // Contract-paper palette (spec: white paper, navy ink, gold accents).
  const paper = { bg: "#ffffff", ink: "#1a2540", line: "#e1e7ed", gold: "#a8884f" };

  return (
    <>
      <div className="dsr-drawer-scrim" onClick={onClose} />
      <aside className="dsr-drawer" role="dialog" aria-label={`Invoice ${inv.number}`}>
        <div className="dsr-drawer-head">
          <div style={{ padding: "var(--container-pad)", paddingBottom: 20, position: "relative" }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Invoice · {inv.number}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.06em", color: "var(--bone-050)" }}>{inv.clientName}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
              <FinStatusBadge status={inv.status} />
              <span style={{ fontSize: 12, color: "var(--bone-300)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                {inv.paidDate ? `Paid ${finFmt(inv.paidDate)}` : `Due ${finFmt(inv.dueDate)}`} · {inv.source === "derived" ? "from booking" : inv.source === "manual" ? "raised manually" : "prior season"}
              </span>
            </div>
            <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: "var(--container-pad)", right: "var(--container-pad)", color: "var(--bone-300)" }}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="dsr-drawer-body">
          <div style={{ padding: "28px var(--container-pad) 40px" }}>
            {/* ---- paper ---- */}
            <div style={{ background: paper.bg, color: paper.ink, border: `1px solid ${paper.line}`, padding: "36px 34px", fontFamily: "var(--font-body)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: "0.14em", textTransform: "uppercase" }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 8, color: "#5a6478" }}>
                    {s.address}<br />{s.email} · {s.phone}<br />{s.abn}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", color: paper.gold, fontWeight: 600 }}>
                    {isTax ? "Tax Invoice" : "Invoice"}
                  </div>
                  <div className="numeric" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.8, color: "#5a6478" }}>
                    {inv.number}<br />
                    Issued {finFmt(inv.issueDate, { day: "2-digit", month: "short", year: "numeric" })}<br />
                    Due {finFmt(inv.dueDate, { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${paper.line}`, margin: "24px 0", paddingTop: 18 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: paper.gold, marginBottom: 6 }}>Billed To</div>
                <div style={{ fontSize: 14, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>{inv.clientName}</div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${paper.ink}` }}>
                    <th style={{ textAlign: "left", padding: "8px 0", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>Description</th>
                    {isTax && <th style={{ textAlign: "right", padding: "8px 0", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>GST</th>}
                    <th style={{ textAlign: "right", padding: "8px 0", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${paper.line}` }}>
                    <td style={{ padding: "14px 0", lineHeight: 1.5 }}>{inv.desc}</td>
                    {isTax && <td className="numeric" style={{ textAlign: "right", padding: "14px 0", color: "#5a6478" }}>{finAUD(inv.gst)}</td>}
                    <td className="numeric" style={{ textAlign: "right", padding: "14px 0" }}>{finAUD(isTax ? inv.net : inv.gross)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <div style={{ width: 240 }}>
                  {isTax && <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}><span>Subtotal</span><span className="numeric">{finAUD(inv.net)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}><span>GST 10%</span><span className="numeric">{finAUD(inv.gst)}</span></div>
                  </>}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0 0", marginTop: 6, borderTop: `1px solid ${paper.ink}`, fontSize: 14, fontWeight: 600 }}>
                    <span>Total {isTax ? "(incl. GST)" : ""}</span><span className="numeric">{finAUD(inv.gross)}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${paper.line}`, fontSize: 11, lineHeight: 1.8, color: "#5a6478" }}>
                {isTax ?
                <>The total price includes GST. {inv.gross >= 1000 ? "Recipient identity shown as required for taxable supplies of $1,000 or more." : ""}</> :
                <>No GST has been charged — {s.name} is not registered for GST.</>
                }
                <br />Payment: NAB · BSB 083-004 · Account 46 882 190 · Reference {inv.number}
              </div>
            </div>

            {/* ---- actions ---- */}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              {inv.paidDate ?
              <button className="btn btn-ghost btn-sm" onClick={() => { setInvoicePaid(inv.id, false); toast(`${inv.number} marked unpaid`); }}>Mark Unpaid</button> :
              <button className="btn btn-primary btn-sm" onClick={() => { setInvoicePaid(inv.id, true); toast(`Payment recorded against ${inv.number}`); }}>Record Payment</button>
              }
              <button className="btn btn-ghost btn-sm" onClick={() => toast("Invoice sent to client (demo)")}><Icon name="inbox" size={13} /> Send to Client</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("PDF export queued (demo)")}><Icon name="download" size={13} /> PDF</button>
            </div>
            {inv.source === "derived" &&
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                This invoice is derived from booking {finBookingRef(inv.bookingId)} — payment status stays in step with the booking record.
              </div>
            }
          </div>
        </div>
      </aside>
    </>);
};

Object.assign(window, { AdminFinance, FinMoney, FinTabBtn, FinField, FinStatusBadge, finShellStyles });
