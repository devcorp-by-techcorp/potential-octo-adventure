/* eslint-disable */
// ============================================================
// ADMIN FINANCE — Expenses / GST & BAS / Reports / Accounts tabs.
// Depends on finance-core.jsx (engine) + finance.jsx (shell bits).
// ============================================================

// ============================================================
// EXPENSES — register + password-gated edit/delete + audit view
// ============================================================
// Fields compared when an edit is finalised (for the audit diff).
const FIN_EDIT_FIELDS = [
  { k: "date", label: "Date", fmt: (v) => finFmt(v) },
  { k: "supplier", label: "Supplier", fmt: (v) => v },
  { k: "desc", label: "Description", fmt: (v) => v },
  { k: "category", label: "Category", fmt: (v) => finCategory(v).label },
  { k: "gross", label: "Amount", fmt: (v) => finAUD(v) },
  { k: "withheld", label: "PAYG withheld", fmt: (v) => v ? finAUD(v) : "—" },
];
const finExpenseChanges = (before, after) => FIN_EDIT_FIELDS.
filter((f) => (before[f.k] ?? "") !== (after[f.k] ?? "")).
map((f) => ({ field: f.label, from: f.fmt(before[f.k]), to: f.fmt(after[f.k]) }));

const FinExpenses = ({ settings, period, expenses, setExpenses }) => {
  const toast = useToast();
  const log = useFinAudit();
  const [view, setView] = useState("register");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gate, setGate] = useState(null); // { kind, exp, draft }
  const rows = expenses.map((e) => finExpense(e, settings)).filter((e) => finInPeriod(e.date, period));
  const total = finR2(rows.reduce((s, e) => s + e.gross, 0));
  const credits = finR2(rows.reduce((s, e) => s + e.gst, 0));
  const cols = settings.gstRegistered ? "0.7fr 1.7fr 1.1fr 0.7fr 0.7fr 0.4fr" : "0.7fr 1.9fr 1.2fr 0.8fr 0.4fr";
  const editing = editingId ? expenses.find((x) => x.id === editingId) : null;
  const expLine = (e) => `${finFmt(e.date)} · ${e.supplier} · ${finAUD(e.gross)}`;

  // Edit form submitted → diff, then demand the second password.
  const submitEdit = (draft) => {
    const changes = finExpenseChanges(editing, draft);
    if (changes.length === 0) {
      finAuditAppend({ action: "edit_cancelled", ref: editing.id, summary: `Edit closed with no changes — ${expLine(editing)}` });
      toast("No changes to save");
      setEditingId(null);
      return;
    }
    setGate({ kind: "edit-save", exp: editing, draft, changes });
  };

  const cancelEdit = () => {
    finAuditAppend({ action: "edit_cancelled", ref: editing.id, summary: `Edit abandoned without saving — ${expLine(editing)}` });
    setEditingId(null);
  };

  // Second password verified → the gated action is finalised.
  const onVerified = () => {
    const { kind, exp, draft, changes } = gate;
    if (kind === "edit-unlock") {
      finAuditAppend({ action: "edit_unlocked", ref: exp.id, summary: `Editing unlocked — ${expLine(exp)}` });
      setAdding(false);
      setEditingId(exp.id);
      setGate(null);
    } else if (kind === "edit-save") {
      setExpenses((xs) => xs.map((x) => {
        if (x.id !== exp.id) return x;
        const merged = { ...x, ...draft, edited: (x.edited || 0) + 1, editedAt: new Date().toISOString() };
        if (!draft.withheld) delete merged.withheld;
        return merged;
      }).sort((a, b) => b.date.localeCompare(a.date)));
      finAuditAppend({ action: "edit_saved", ref: exp.id, summary: `Changes saved — ${exp.supplier} expense`, changes });
      toast("Expense updated — recorded in the audit trail");
      setEditingId(null);
      setGate(null);
    } else if (kind === "delete-1") {
      finAuditAppend({ action: "delete_authorised", ref: exp.id, summary: `Deletion authorised — ${expLine(exp)}` });
      setGate({ kind: "delete-2", exp });
    } else if (kind === "delete-2") {
      setExpenses((xs) => xs.filter((x) => x.id !== exp.id));
      finAuditAppend({ action: "deleted", ref: exp.id, summary: `Expense permanently deleted — ${exp.supplier}`, record: { date: exp.date, supplier: exp.supplier, desc: exp.desc, gross: exp.gross } });
      toast("Expense deleted — recorded in the audit trail");
      setGate(null);
    }
  };

  const gateProps = gate ? {
    "edit-unlock": {
      title: "Unlock Editing",
      message: `You are opening a saved record for editing — ${gate.exp.supplier}, ${finFmt(gate.exp.date)}. Changes to the register require identity verification before the workflow begins.`,
      confirmLabel: "Verify & Unlock",
    },
    "edit-save": {
      title: "Finalise Changes",
      message: "Review the changes below, then re-enter your password to save them to the register.",
      confirmLabel: "Verify & Save",
      summary:
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(gate.changes || []).map((c, i) =>
        <div key={i} style={{ fontSize: 12, color: "var(--bone-300)" }}>
              <span style={{ color: "var(--bone-400)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10, marginRight: 10 }}>{c.field}</span>
              <span className="numeric" style={{ color: "var(--bone-400)", textDecoration: "line-through" }}>{c.from}</span>
              <span style={{ color: "var(--gold-300)", margin: "0 8px" }}>→</span>
              <span className="numeric" style={{ color: "var(--bone-100)" }}>{c.to}</span>
            </div>
        )}
        </div>,
    },
    "delete-1": {
      title: "Authorise Deletion",
      message: `Deleting an expense permanently removes it from the register — ${gate.exp.supplier}, ${finFmt(gate.exp.date)}. Re-enter your password to begin the deletion sequence.`,
      confirmLabel: "Verify & Continue",
      danger: true,
    },
    "delete-2": {
      title: "Confirm Permanent Deletion",
      message: "Final confirmation. This record will be removed from the register and the deletion written to the audit trail.",
      confirmLabel: "Verify & Delete",
      danger: true,
      summary:
      <div style={{ fontSize: 12.5, color: "var(--bone-200)" }}>
          {finFmt(gate.exp.date)} · {gate.exp.supplier}
          <div style={{ fontSize: 11.5, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 3 }}>{gate.exp.desc}</div>
          <div className="numeric" style={{ marginTop: 6, color: "var(--gold-200)" }}>{finAUD(gate.exp.gross)}</div>
        </div>,
    },
  }[gate.kind] : null;

  const iconBtn = (name, label, onClick) =>
  <button onClick={onClick} aria-label={label} title={label}
  style={{ color: "var(--bone-500)", padding: 4 }}
  onMouseEnter={(ev) => ev.currentTarget.style.color = "var(--gold-200)"}
  onMouseLeave={(ev) => ev.currentTarget.style.color = "var(--bone-500)"}>
      <Icon name={name} size={13} />
    </button>;

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--ink-400)" }}>
        <FinTabBtn label="Expense Register" active={view === "register"} onClick={() => setView("register")} />
        <FinTabBtn label={`Audit Trail (${log.length})`} active={view === "audit"} onClick={() => setView("audit")} />
      </div>

      {view === "audit" && <window.FinAuditTrail log={log} />}

      {view === "register" && <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="label-sm">Expenses · {period.label}</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 6 }}>
            {rows.length} records · {finAUD(total)} total{settings.gstRegistered ? ` · ${finAUD(credits)} in GST credits` : ""}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setAdding((a) => !a); }}><Icon name="plus" size={12} /> Record Expense</button>
      </div>

      {adding && !editing && <FinExpenseForm settings={settings} setExpenses={setExpenses} onDone={() => setAdding(false)} />}

      {editing &&
      <FinExpenseForm key={editing.id} settings={settings} setExpenses={setExpenses}
      initial={editing} heading={`Edit Expense · ${editing.id.toUpperCase()}`} submitLabel="Save Changes"
      onSubmit={submitEdit} onDone={cancelEdit} />
      }

      <div style={{ ...finShellStyles.th, gridTemplateColumns: cols }}>
        <div>Date</div><div>Supplier · Description</div><div>Category</div>
        {settings.gstRegistered && <div style={{ textAlign: "right" }}>GST Credit</div>}
        <div style={{ textAlign: "right" }}>Amount</div><div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--ink-400)", border: "1px solid var(--ink-400)", borderTop: "none" }}>
        {rows.map((e) =>
        <div key={e.id} style={{ ...finShellStyles.tr, gridTemplateColumns: cols, outline: editingId === e.id ? "1px solid var(--gold-400)" : "none" }}>
            <div className="numeric" style={{ fontSize: 12, color: "var(--bone-300)" }}>{finFmt(e.date)}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--bone-100)" }}>{e.supplier}</span>
                {e.edited > 0 &&
              <span className="badge badge-muted" title={`Edited ${e.edited} time${e.edited > 1 ? "s" : ""} — see Audit Trail`}>
                    edited{e.edited > 1 ? ` ×${e.edited}` : ""}
                  </span>
              }
              </div>
              <div style={{ fontSize: 11, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 2 }}>{e.desc}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--bone-300)", letterSpacing: "0.06em" }}>{e.cat.label}</span>
              {e.capital && <span className="badge badge-gold">asset</span>}
            </div>
            {settings.gstRegistered &&
          <div className="numeric" style={{ textAlign: "right", fontSize: 13, color: e.gst > 0 ? "var(--bone-100)" : "var(--bone-500)" }}>
              {e.gst > 0 ? finAUD(e.gst) : "—"}
            </div>
          }
            <FinMoney v={e.gross} />
            <div style={{ display: "flex", gap: 2, justifySelf: "end" }}>
              {iconBtn("edit", "Edit expense (password required)", () => setGate({ kind: "edit-unlock", exp: e }))}
              {iconBtn("trash", "Delete expense (password required)", () => setGate({ kind: "delete-1", exp: e }))}
            </div>
          </div>
        )}
        {rows.length === 0 &&
        <div style={{ background: "var(--ink-100)", padding: "28px 24px", fontSize: 13, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            No expenses recorded in this period.
          </div>
        }
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", color: "var(--gold-400)" }}><Icon name="lock" size={13} /></span>
        Editing or deleting a saved expense requires password re-entry to unlock the workflow and again to finalise it. Every step is written to the audit trail.
      </div>
      {settings.gstRegistered &&
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          GST credits are calculated at one-eleventh of the GST-inclusive price. Wages, superannuation and bank fees carry no credit.
        </div>
      }
      </>}

      {gate &&
      <window.FinReauthModal open={true} refId={gate.exp.id} context={gateProps.title}
      title={gateProps.title} message={gateProps.message} confirmLabel={gateProps.confirmLabel}
      danger={gateProps.danger} summary={gateProps.summary}
      onCancel={() => setGate(null)} onVerified={onVerified} />
      }
    </div>);
};

const FinExpenseForm = ({ settings, setExpenses, onDone, initial, heading, submitLabel, onSubmit }) => {
  const toast = useToast();
  const [f, setF] = useState(initial ?
  { date: initial.date, supplier: initial.supplier, desc: initial.desc, category: initial.category, gross: String(initial.gross), withheld: initial.withheld != null ? String(initial.withheld) : "" } :
  { date: FIN_TODAY, supplier: "", desc: "", category: "consumables", gross: "", withheld: "" });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const cat = finCategory(f.category);
  const gross = parseFloat(f.gross) || 0;

  const save = () => {
    if (!f.supplier.trim() || gross <= 0) { toast("A supplier and an amount are required"); return; }
    const vals = {
      date: f.date, supplier: f.supplier.trim(),
      desc: f.desc.trim() || cat.label, category: f.category, gross: finR2(gross),
      ...(cat.wages && parseFloat(f.withheld) > 0 ? { withheld: finR2(parseFloat(f.withheld)) } : {}),
    };
    if (onSubmit) { onSubmit(vals); return; }
    setExpenses((xs) => [{ id: "xm-" + Date.now(), ...vals }, ...xs].sort((a, b) => b.date.localeCompare(a.date)));
    toast("Expense recorded");
    onDone();
  };

  return (
    <div style={{ background: "var(--ink-100)", border: "1px solid var(--gold-400)", padding: 24, marginBottom: 24 }}>
      <div className="label-sm" style={{ marginBottom: 18 }}>{heading || "Record Expense"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16 }}>
        <FinField label="Date" span={1}>
          <input className="input numeric" type="date" value={f.date} onChange={set("date")} />
        </FinField>
        <FinField label="Supplier" span={2}>
          <input className="input" value={f.supplier} onChange={set("supplier")} placeholder="Who was paid" />
        </FinField>
        <FinField label="Description" span={3}>
          <input className="input" value={f.desc} onChange={set("desc")} placeholder="What it was for" />
        </FinField>
        <FinField label="ATO Category" span={2}>
          <select className="select" value={f.category} onChange={set("category")}>
            {FIN_EXPENSE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </FinField>
        <FinField label={settings.gstRegistered && cat.gst ? "Amount (incl. GST) $" : "Amount $"} span={1}>
          <input className="input numeric" type="number" min="0" step="0.01" value={f.gross} onChange={set("gross")} placeholder="0.00" />
        </FinField>
        {cat.wages &&
        <FinField label="PAYG Withheld $" span={1}>
            <input className="input numeric" type="number" min="0" step="0.01" value={f.withheld} onChange={set("withheld")} placeholder="0.00" />
          </FinField>
        }
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
        <button className="btn btn-primary btn-sm" onClick={save}>{submitLabel || "Save Expense"}</button>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Cancel</button>
        {initial &&
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--bone-400)", letterSpacing: "0.06em" }}>
            <Icon name="lock" size={12} /> Saving requires password verification
          </span>
        }
        <span style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          {cat.capital ? `Capital asset — ${settings.gstRegistered ? "GST credit claimable; " : ""}depreciated via the write-off rules, not expensed.` :
          settings.gstRegistered && cat.gst && gross > 0 ? `GST credit of ${finAUD(finGstOfGross(gross))} will be claimed on the BAS.` :
          !cat.gst ? "No GST credit applies to this category." : ""}
        </span>
      </div>
    </div>);
};

// ============================================================
// GST & BAS — quarterly activity statement worksheet
// ============================================================
const FinBasRow = ({ code, label, v, strong, note }) =>
<div style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 16, alignItems: "baseline", padding: "12px 0", borderBottom: "1px solid var(--ink-300)" }}>
    <div className="numeric" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--gold-300)", fontWeight: 600 }}>{code}</div>
    <div>
      <div style={{ fontSize: 13, color: strong ? "var(--bone-050)" : "var(--bone-200)", fontWeight: strong ? 600 : 400 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 2 }}>{note}</div>}
    </div>
    <div className="numeric" style={{ fontSize: strong ? 15 : 13, color: strong ? "var(--gold-200)" : "var(--bone-100)", fontFamily: strong ? "var(--font-display)" : "var(--font-body)" }}>{finAUD(v)}</div>
  </div>;

const FinBas = ({ settings, invoices, expenses }) => {
  const [qKey, setQKey] = useState(FIN_CURRENT_QUARTER.key);
  const quarter = FIN_PERIODS.quarters.find((q) => q.key === qKey);
  const bas = finBAS(quarter, invoices, expenses, settings);

  if (!settings.gstRegistered) {
    return (
      <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 40, maxWidth: 640 }}>
        <div className="label-sm" style={{ marginBottom: 14 }}>No Activity Statement Required</div>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: "var(--bone-200)", fontFamily: "var(--font-serif)" }}>
          The studio is currently set as <em>not registered for GST</em>, so no BAS is lodged and no GST
          is charged on invoices. Registration becomes mandatory once GST turnover reaches $75,000 in
          any rolling 12-month period — switch the GST Registration selector above to activate the GST
          system, tax-invoice templates and quarterly BAS worksheet.
        </p>
      </div>);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--ink-400)" }}>
        {FIN_PERIODS.quarters.map((q) => <FinTabBtn key={q.key} label={q.label} active={qKey === q.key} onClick={() => setQKey(q.key)} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 32, alignItems: "start" }}>
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "12px 28px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 8px" }}>
            <div className="label-sm">Business Activity Statement · {quarter.label}</div>
            <div style={{ fontSize: 11, color: "var(--bone-400)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Simpler BAS · {settings.basis} basis</div>
          </div>

          <div className="eyebrow" style={{ fontSize: 10, margin: "18px 0 4px" }}>Goods and services tax</div>
          <FinBasRow code="G1" label="Total sales (GST-inclusive)" v={bas.G1} note={`${bas.salesCount} ${settings.basis === "cash" ? "payments received" : "invoices issued"} this quarter`} />
          <FinBasRow code="1A" label="GST on sales" v={bas.A1} />
          <FinBasRow code="G10" label="Capital purchases" v={bas.G10} />
          <FinBasRow code="G11" label="Non-capital purchases" v={bas.G11} note="Wages and superannuation are not purchases — reported at W1, not G11" />
          <FinBasRow code="1B" label="GST on purchases (input tax credits)" v={bas.B1} />

          <div className="eyebrow" style={{ fontSize: 10, margin: "22px 0 4px" }}>PAYG tax withheld</div>
          <FinBasRow code="W1" label="Total salary, wages and other payments" v={bas.W1} />
          <FinBasRow code="W2" label="Amount withheld from payments at W1" v={bas.W2} />

          <div className="eyebrow" style={{ fontSize: 10, margin: "22px 0 4px" }}>PAYG income tax instalment</div>
          <FinBasRow code="T1" label="Instalment income (GST-exclusive sales)" v={bas.T1} />
          <FinBasRow code="5A" label={`Instalment — T1 × ${(FIN_PAYGI_RATE * 100).toFixed(1)}% (ATO-notified rate)`} v={bas.A5} />

          <div style={{ marginTop: 22, paddingTop: 6 }}>
            <FinBasRow code="" label="Net GST (1A − 1B)" v={bas.gstNet} strong />
            <FinBasRow code="" label={bas.netPayable >= 0 ? "Amount payable this statement" : "Refund due this statement"} v={Math.abs(bas.netPayable)} strong
            note="Net GST + PAYG withheld (W2) + PAYG instalment (5A)" />
          </div>
        </div>

        <div>
          <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 24 }}>
            <div className="label-sm" style={{ marginBottom: 16 }}>Lodgment</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--ink-300)", fontSize: 13 }}>
              <span style={{ color: "var(--bone-300)" }}>Period</span><span className="numeric" style={{ color: "var(--bone-100)" }}>{finFmt(quarter.start)} – {finFmt(quarter.end)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--ink-300)", fontSize: 13 }}>
              <span style={{ color: "var(--bone-300)" }}>Due for lodgment</span><span className="numeric" style={{ color: "var(--gold-200)" }}>{finFmt(quarter.due, { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 13 }}>
              <span style={{ color: "var(--bone-300)" }}>Reporting method</span><span style={{ color: "var(--bone-100)" }}>Simpler BAS</span>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.8, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            Simpler BAS reports G1, 1A and 1B only; the G10/G11 worksheet rows are kept for the
            studio's records. Figures follow the {settings.basis} accounting basis selected above.
            Review with a registered BAS agent before lodging through Online services for business.
          </div>
        </div>
      </div>
    </div>);
};

// ============================================================
// REPORTS — P&L, cash flow, super, PAYG, depreciation
// ============================================================
const FinReports = ({ settings, period, invoices, expenses }) => {
  const pl = finPL(period, invoices, expenses, settings);
  const cf = finCashflow(period, invoices, expenses, settings);
  const sg = finSuper(expenses, settings);
  const dep = finDepreciation(expenses, settings);
  const fyBasTotal = FIN_PERIODS.quarters.reduce((s, q) => s + finBAS(q, invoices, expenses, settings).A5, 0);
  const plRows = (by) => Object.entries(by).sort().map(([code, v]) => ({ code, name: finAccount(code).name, v }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "start" }}>
      {/* ---- P&L statement ---- */}
      <div>
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "20px 28px 24px" }}>
          <div className="label-sm" style={{ marginBottom: 4 }}>Profit &amp; Loss Statement</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 14 }}>
            {period.label} · {settings.basis} basis · {settings.gstRegistered ? "GST-exclusive amounts" : "gross amounts (no GST registration)"}
          </div>

          <div className="eyebrow" style={{ fontSize: 10, margin: "14px 0 2px" }}>Income</div>
          {plRows(pl.incomeBy).map((r) => <FinRptRow key={r.code} label={`${r.code} · ${r.name}`} v={r.v} />)}
          <FinRptRow label="Total income" v={pl.income} strong />

          {Object.keys(pl.cogsBy).length > 0 && <>
            <div className="eyebrow" style={{ fontSize: 10, margin: "18px 0 2px" }}>Cost of sales</div>
            {plRows(pl.cogsBy).map((r) => <FinRptRow key={r.code} label={`${r.code} · ${r.name}`} v={r.v} neg />)}
            <FinRptRow label="Gross profit" v={pl.grossProfit} strong />
          </>}

          <div className="eyebrow" style={{ fontSize: 10, margin: "18px 0 2px" }}>Operating expenses</div>
          {plRows(pl.expBy).map((r) => <FinRptRow key={r.code} label={`${r.code} · ${r.name}`} v={r.v} neg />)}
          <FinRptRow label="Total operating expenses" v={pl.opex} strong neg />

          <div style={{ marginTop: 14, borderTop: "1px solid var(--gold-400)", paddingTop: 4 }}>
            <FinRptRow label="Net profit before income tax" v={pl.netProfit} strong gold />
          </div>
        </div>

        {/* ---- cash flow ---- */}
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "20px 28px 24px", marginTop: 28 }}>
          <div className="label-sm" style={{ marginBottom: 14 }}>Cash Flow · {period.label}</div>
          <FinRptRow label="Opening bank balance" v={cf.opening} />
          <FinRptRow label="Cash receipts (incl. GST collected)" v={cf.inflow} />
          <FinRptRow label="Cash payments (incl. GST paid)" v={cf.outflow} neg />
          <FinRptRow label="Net cash movement" v={cf.net} strong />
          <FinRptRow label="Closing bank balance" v={cf.closing} strong gold />
        </div>
      </div>

      <div>
        {/* ---- super guarantee ---- */}
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 24 }}>
          <div className="label-sm" style={{ marginBottom: 6 }}>Super Guarantee · {(FIN_SG_RATE * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 12 }}>
            Payable on ordinary time earnings within 28 days of each quarter's end.
          </div>
          {sg.filter((r) => r.otes > 0).map((r) =>
          <div key={r.quarter.key} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--ink-300)" }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--bone-100)" }}>{r.quarter.label}</div>
                <div style={{ fontSize: 11, color: "var(--bone-400)", marginTop: 2 }} className="numeric">wages {finAUD(r.otes)} · due {finFmt(r.quarter.superDue)}</div>
              </div>
              <div className="numeric" style={{ fontSize: 13, color: "var(--bone-100)" }}>{finAUD(r.sg)}</div>
              <span className={r.status === "paid" ? "badge badge-success" : r.status === "accruing" ? "badge badge-info" : "badge badge-gold"}>{r.status}</span>
            </div>
          )}
        </div>

        {/* ---- PAYG instalments ---- */}
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 24, marginTop: 28 }}>
          <div className="label-sm" style={{ marginBottom: 6 }}>PAYG Instalments · Estimate</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 12 }}>
            Instalment income × {(FIN_PAYGI_RATE * 100).toFixed(1)}% notified rate, paid quarterly with the BAS and credited against the year's income tax.
          </div>
          <FinRptRow label="FY instalments to date" v={fyBasTotal} strong gold />
        </div>

        {/* ---- depreciation ---- */}
        <div style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: 24, marginTop: 28 }}>
          <div className="label-sm" style={{ marginBottom: 6 }}>Depreciation Schedule</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginBottom: 12 }}>
            Assets ≤ {finAUD0(FIN_IAWO_THRESHOLD)} (GST-exclusive) are written off in full when first used; costlier assets enter the general small business pool.
          </div>
          {dep.items.map((a) =>
          <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--ink-300)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 12.5, color: "var(--bone-100)" }}>{a.desc.replace(" (asset)", "")}</div>
                <div className="numeric" style={{ fontSize: 13, color: "var(--bone-100)", flexShrink: 0 }}>{finAUD(a.net)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 3 }}>
                <div style={{ fontSize: 11, color: a.iawo ? "var(--gold-300)" : "var(--bone-400)" }}>{a.treatment}</div>
                <div className="numeric" style={{ fontSize: 11, color: "var(--bone-400)", flexShrink: 0 }}>deduction {finAUD(a.deduction)}</div>
              </div>
            </div>
          )}
          <FinRptRow label="FY deduction total" v={dep.totalDeduction} strong gold />
        </div>
      </div>
    </div>);
};

const FinRptRow = ({ label, v, strong, gold, neg }) =>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: strong ? "12px 0" : "8px 0", borderBottom: strong ? "none" : "1px solid var(--ink-300)" }}>
    <div style={{ fontSize: strong ? 12 : 12.5, color: strong ? "var(--bone-050)" : "var(--bone-300)", letterSpacing: strong ? "0.12em" : "0.01em", textTransform: strong ? "uppercase" : "none", fontWeight: strong ? 600 : 400 }}>{label}</div>
    <div className="numeric" style={{ fontSize: strong ? 15 : 13, fontFamily: strong ? "var(--font-display)" : "var(--font-body)", color: gold ? "var(--gold-200)" : "var(--bone-100)", flexShrink: 0 }}>
      {neg ? `(${finAUD(Math.abs(v))})` : finAUD(v)}
    </div>
  </div>;

// ============================================================
// ACCOUNTS — chart of accounts + general ledger journal
// ============================================================
const FinAccounts = ({ settings, period, invoices, expenses }) => {
  const [view, setView] = useState("ledger");
  const entries = useMemo(() => finLedger(invoices, expenses, settings).filter((e) => finInPeriod(e.date, period)), [invoices, expenses, settings, period]);
  const totalDr = finR2(entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.dr, 0), 0));
  const totalCr = finR2(entries.reduce((s, e) => s + e.lines.reduce((t, l) => t + l.cr, 0), 0));
  const types = ["Asset", "Liability", "Equity", "Income", "Cost of Sales", "Expense"];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--ink-400)" }}>
        <FinTabBtn label="General Ledger" active={view === "ledger"} onClick={() => setView("ledger")} />
        <FinTabBtn label="Chart of Accounts" active={view === "coa"} onClick={() => setView("coa")} />
      </div>

      {view === "coa" &&
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "start" }}>
          {types.map((t) => {
          const accounts = FIN_COA.filter((a) => a.type === t);
          if (!accounts.length) return null;
          return (
            <div key={t} style={{ background: "var(--ink-100)", border: "1px solid var(--ink-400)", padding: "16px 22px 8px" }}>
                <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>{t}</div>
                {accounts.map((a) =>
              <div key={a.code} style={{ display: "flex", gap: 14, padding: "9px 0", borderBottom: "1px solid var(--ink-300)", alignItems: "baseline" }}>
                    <span className="numeric" style={{ fontSize: 11, color: "var(--gold-300)", letterSpacing: "0.08em", flexShrink: 0 }}>{a.code}</span>
                    <span style={{ fontSize: 12.5, color: "var(--bone-100)" }}>{a.name}</span>
                  </div>
              )}
              </div>);
        })}
        </div>
      }

      {view === "ledger" && <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div className="label-sm">Journal · {period.label} · {entries.length} entries</div>
          <div className="numeric" style={{ fontSize: 12, color: totalDr === totalCr ? "var(--bone-400)" : "var(--gold-200)" }}>
            DR {finAUD(totalDr)} · CR {finAUD(totalCr)} {totalDr === totalCr ? "· in balance" : "· OUT OF BALANCE"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--ink-400)", border: "1px solid var(--ink-400)" }}>
          {entries.map((e, i) =>
          <div key={i} style={{ background: "var(--ink-100)", padding: "14px 20px" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline", marginBottom: 8 }}>
                <span className="numeric" style={{ fontSize: 12, color: "var(--bone-300)", flexShrink: 0 }}>{finFmt(e.date)}</span>
                <span className="numeric" style={{ fontSize: 11, color: "var(--gold-300)", letterSpacing: "0.08em", flexShrink: 0 }}>{e.ref}</span>
                <span style={{ fontSize: 12.5, color: "var(--bone-200)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>{e.memo}</span>
              </div>
              {e.lines.map((l, j) =>
            <div key={j} style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 12, padding: "4px 0 4px 28px", fontSize: 12 }}>
                  <div style={{ color: "var(--bone-300)" }}>
                    <span className="numeric" style={{ color: "var(--bone-400)", marginRight: 10 }}>{l.account}</span>
                    {finAccount(l.account).name}
                  </div>
                  <div className="numeric" style={{ textAlign: "right", color: "var(--bone-100)" }}>{l.dr > 0 ? finAUD(l.dr) : ""}</div>
                  <div className="numeric" style={{ textAlign: "right", color: "var(--bone-100)" }}>{l.cr > 0 ? finAUD(l.cr) : ""}</div>
                </div>
            )}
            </div>
          )}
          {entries.length === 0 &&
          <div style={{ background: "var(--ink-100)", padding: "28px 24px", fontSize: 13, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              No journal entries in this period.
            </div>
          }
        </div>
      </>}
    </div>);
};

Object.assign(window, { FinExpenses, FinBas, FinReports, FinAccounts });
