/* eslint-disable */
// ============================================================
// FINANCE AUDIT — password-gated record security + append-only
// audit trail for the expense register.
//
//   · Every edit or deletion of an existing expense runs through
//     a password re-entry sequence: once to UNLOCK the workflow,
//     and again to FINALISE (save / confirm delete).
//   · Every event — including failed password attempts and
//     abandoned edits — is written to an append-only, hash-chained
//     audit log (localStorage `is_fin_audit`). Each entry captures
//     the device clock timestamp, timezone, operating system,
//     browser and platform, the actor, the verification method,
//     and a field-level before → after diff.
//   · Entries are chained: each carries the hash of the previous
//     entry, so any tampering breaks the chain and is surfaced
//     in the Audit Trail view ("chain intact" / "chain broken").
// ============================================================

const FIN_AUDIT_KEY = "is_fin_audit";
const FIN_ADMIN_PASSWORD = "illuminate";        // demo credential
const FIN_AUDIT_ACTOR = { name: "Victoria Caine", role: "Studio Manager" };

// --- tamper-evident hash chain (djb2 ×2, 16 hex chars) --------
function finHash(str) {
  let a = 5381, b = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = (((a << 5) + a) ^ c) >>> 0;
    b = (((b << 5) + b) ^ (c + i)) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

// --- device / OS capture --------------------------------------
function finDeviceInfo() {
  const ua = navigator.userAgent || "";
  const os =
    /Windows NT 11/.test(ua) ? "Windows 11" :
    /Windows NT 10/.test(ua) ? "Windows 10/11" :
    /Windows/.test(ua) ? "Windows" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Android/.test(ua) ? "Android" :
    /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return { os, browser, platform: navigator.platform || "—" };
}

// --- log storage ----------------------------------------------
function finAuditLog() {
  try { return JSON.parse(localStorage.getItem(FIN_AUDIT_KEY) || "[]"); }
  catch (e) { return []; }
}

// Append-only writer. Never exposes an update or delete path.
function finAuditAppend({ action, ref, summary, changes, record, ok }) {
  const log = finAuditLog();
  const prev = log.length ? log[log.length - 1].hash : "genesis";
  const now = new Date();
  const core = {
    seq: log.length + 1,
    ts: now.toISOString(),
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || "local",
    actor: FIN_AUDIT_ACTOR.name,
    role: FIN_AUDIT_ACTOR.role,
    action, ref: ref || null,
    summary: summary || "",
    changes: changes || null,
    record: record || null,
    ok: ok !== false,
    method: "password re-entry",
    device: finDeviceInfo(),
    prevHash: prev,
  };
  const entry = { ...core, hash: finHash(prev + JSON.stringify(core)) };
  log.push(entry);
  localStorage.setItem(FIN_AUDIT_KEY, JSON.stringify(log));
  window.dispatchEvent(new CustomEvent("fin-audit"));
  return entry;
}

// Recompute the chain end-to-end; false = log was tampered with.
function finAuditVerify(log) {
  let prev = "genesis";
  for (const e of log) {
    const { hash, ...core } = e;
    if (core.prevHash !== prev || finHash(prev + JSON.stringify(core)) !== hash) return false;
    prev = hash;
  }
  return true;
}

function useFinAudit() {
  const [log, setLog] = useState(finAuditLog);
  useEffect(() => {
    const h = () => setLog(finAuditLog());
    window.addEventListener("fin-audit", h);
    return () => window.removeEventListener("fin-audit", h);
  }, []);
  return log;
}

const finVerifyPassword = (pw) => pw === FIN_ADMIN_PASSWORD;

// Human labels for audit actions + badge styling.
const FIN_AUDIT_ACTIONS = {
  edit_unlocked:    { label: "Edit unlocked",     badge: "badge badge-info" },
  edit_saved:       { label: "Edit saved",        badge: "badge badge-success" },
  edit_cancelled:   { label: "Edit abandoned",    badge: "badge badge-muted" },
  delete_authorised:{ label: "Delete authorised", badge: "badge badge-gold" },
  deleted:          { label: "Record deleted",    badge: "badge badge-gold" },
  auth_failed:      { label: "Auth failed",       badge: "badge badge-gold" },
};

// ============================================================
// RE-AUTH MODAL — password re-entry gate
// ============================================================
const FinReauthModal = ({ open, title, message, confirmLabel, danger, summary, context, refId, onCancel, onVerified }) => {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setPw(""); setError(null); setTimeout(() => inputRef.current && inputRef.current.focus(), 60); }
  }, [open, title]);

  if (!open) return null;

  const submit = (e) => {
    e && e.preventDefault();
    if (finVerifyPassword(pw)) { onVerified(); return; }
    setError("That password is not correct. This attempt has been recorded.");
    setPw("");
    finAuditAppend({
      action: "auth_failed", ref: refId, ok: false,
      summary: `Password verification failed — ${context || title}`,
    });
    inputRef.current && inputRef.current.focus();
  };

  return (
    <Modal open={true} onClose={onCancel} width={480}>
      <div style={{ padding: "8px 6px 2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ color: danger ? "var(--gold-200)" : "var(--gold-300)", display: "flex" }}>
            <Icon name="lock" size={20} />
          </span>
          <div className="eyebrow">— Security check</div>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.05em", color: "var(--bone-050)", marginBottom: 10 }}>
          {title}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--bone-300)", fontFamily: "var(--font-serif)", margin: "0 0 18px" }}>
          {message}
        </p>

        {summary &&
        <div style={{ background: "var(--ink-050)", border: "1px solid var(--ink-400)", padding: "14px 18px", marginBottom: 18 }}>
            {summary}
          </div>
        }

        <form onSubmit={submit}>
          <label style={{ display: "block" }}>
            <span className="field-label">Re-enter your password</span>
            <input ref={inputRef} className="input" type="password" value={pw}
              onChange={(e) => { setPw(e.target.value); setError(null); }}
              autoComplete="current-password" placeholder="••••••••••" />
          </label>
          {error &&
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 12, color: "var(--gold-200)" }}>
              <Icon name="alert" size={14} /> {error}
            </div>
          }
          <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
            <button type="submit" className="btn btn-primary btn-sm">{confirmLabel || "Verify & Continue"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 11, color: "var(--bone-500)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
              Demo password: illuminate
            </span>
          </div>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--ink-400)", fontSize: 11, lineHeight: 1.7, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          This action is written to the finance audit trail with your identity, device and timestamp. Failed attempts are recorded.
        </div>
      </div>
    </Modal>);
};

// ============================================================
// AUDIT TRAIL — read-only, append-only log view
// ============================================================
const FinAuditTrail = ({ log }) => {
  const entries = [...log].reverse();
  const intact = finAuditVerify(log);
  const fmtTs = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" }) +
      " · " + d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="label-sm">Audit Trail · Expense Register</div>
          <div style={{ fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic", marginTop: 6 }}>
            {log.length} event{log.length === 1 ? "" : "s"} · append-only · hash-chained for tamper evidence
          </div>
        </div>
        {log.length > 0 &&
        <span className={intact ? "badge badge-success" : "badge badge-gold"} style={{ marginBottom: 2 }}>
            {intact ? "chain intact" : "chain broken"}
          </span>
        }
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--ink-400)", border: "1px solid var(--ink-400)" }}>
        {entries.map((e) => {
          const a = FIN_AUDIT_ACTIONS[e.action] || { label: e.action, badge: "badge badge-muted" };
          return (
            <div key={e.seq} style={{ background: "var(--ink-100)", padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="numeric" style={{ fontSize: 11, color: "var(--bone-400)", letterSpacing: "0.06em" }}>#{String(e.seq).padStart(3, "0")}</span>
                <span className="numeric" style={{ fontSize: 12, color: "var(--bone-300)" }}>{fmtTs(e.ts)}</span>
                <span className={a.badge}>{a.label}</span>
                {e.ref && <span className="numeric" style={{ fontSize: 11, color: "var(--gold-300)", letterSpacing: "0.08em" }}>{String(e.ref).toUpperCase()}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--bone-100)", marginTop: 8 }}>{e.summary}</div>

              {e.changes && e.changes.length > 0 &&
              <div style={{ marginTop: 10, borderLeft: "1px solid var(--ink-400)", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  {e.changes.map((c, i) =>
                <div key={i} style={{ fontSize: 12, color: "var(--bone-300)" }}>
                      <span style={{ color: "var(--bone-400)", letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10, marginRight: 10 }}>{c.field}</span>
                      <span className="numeric" style={{ color: "var(--bone-400)", textDecoration: "line-through" }}>{c.from}</span>
                      <span style={{ color: "var(--gold-300)", margin: "0 8px" }}>→</span>
                      <span className="numeric" style={{ color: "var(--bone-100)" }}>{c.to}</span>
                    </div>
                )}
                </div>
              }
              {e.record &&
              <div style={{ marginTop: 10, borderLeft: "1px solid var(--ink-400)", paddingLeft: 14, fontSize: 12, color: "var(--bone-300)" }}>
                  Final record: {finFmt(e.record.date)} · {e.record.supplier} · {e.record.desc} · <span className="numeric">{finAUD(e.record.gross)}</span>
                </div>
              }

              <div style={{ marginTop: 10, fontSize: 10.5, color: "var(--bone-500)", letterSpacing: "0.04em", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>{e.actor} · {e.role}</span>
                <span>{e.device.os} · {e.device.browser}</span>
                <span>{e.method}</span>
                <span className="numeric">tz {e.tz}</span>
                <span className="numeric">hash {e.hash.slice(0, 10)} ⇠ {e.prevHash === "genesis" ? "genesis" : e.prevHash.slice(0, 10)}</span>
              </div>
            </div>);
        })}
        {entries.length === 0 &&
        <div style={{ background: "var(--ink-100)", padding: "28px 24px", fontSize: 13, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            No audit events yet. Editing or deleting an expense — and any failed password attempt — will be recorded here automatically.
          </div>
        }
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "var(--bone-400)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        Entries are system-generated at the moment of each action and cannot be edited or removed. Each entry carries the hash of the one before it — the chain status above re-verifies the full log on every view.
      </div>
    </div>);
};

Object.assign(window, {
  finAuditLog, finAuditAppend, finAuditVerify, useFinAudit, finVerifyPassword,
  FinReauthModal, FinAuditTrail, FIN_AUDIT_ACTIONS,
});
