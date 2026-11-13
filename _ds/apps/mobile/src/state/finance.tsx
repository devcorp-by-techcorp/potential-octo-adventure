/**
 * Finance state — bookkeeping settings, the expense register, and the
 * append-only audit trail that guards it.
 *
 * Mirrors apps/web/src/features/finance/finance-audit.jsx: every edit or
 * deletion of a saved expense runs a password re-entry sequence (once to
 * UNLOCK the workflow, again to FINALISE it), and every event — including
 * failed password attempts and abandoned edits — is appended to a
 * hash-chained log. Entries carry the device clock, timezone, OS/platform,
 * actor, verification method, and a field-level before → after diff.
 *
 * The log is append-only by construction: this module exposes `append` and
 * `verify`, and no update or delete path. It lives in memory for the session
 * (the web build persists to localStorage; native persistence lands with the
 * backend, since the log must ultimately be server-held to be defensible).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Platform } from "react-native";
import { FIN_SETTINGS_DEFAULT, finSeedExpenses, type Expense, type FinSettings } from "~/data/finance";

export const FIN_ADMIN_PASSWORD = "illuminate"; // demo credential
export const FIN_AUDIT_ACTOR = { name: "Victoria Caine", role: "Studio Manager" };

export type AuditAction = "edit_unlocked" | "edit_saved" | "edit_cancelled" | "delete_authorised" | "deleted" | "auth_failed";

export const FIN_AUDIT_ACTIONS: Record<AuditAction, { label: string; tone: "success" | "warning" | "gold" | "muted" }> = {
  edit_unlocked: { label: "Edit unlocked", tone: "muted" },
  edit_saved: { label: "Edit saved", tone: "success" },
  edit_cancelled: { label: "Edit abandoned", tone: "muted" },
  delete_authorised: { label: "Delete authorised", tone: "gold" },
  deleted: { label: "Record deleted", tone: "gold" },
  auth_failed: { label: "Auth failed", tone: "warning" },
};

export interface FieldChange { field: string; from: string; to: string; }
export interface AuditEntry {
  seq: number; ts: string; tz: string; actor: string; role: string;
  action: AuditAction; ref: string | null; summary: string;
  changes: FieldChange[] | null;
  record: { date: string; supplier: string; desc: string; gross: number } | null;
  ok: boolean; method: string;
  device: { os: string; browser: string; platform: string };
  prevHash: string; hash: string;
}

/** Tamper-evident hash chain (djb2 ×2, 16 hex chars). */
export function finHash(str: string) {
  let a = 5381, b = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = (((a << 5) + a) ^ c) >>> 0;
    b = (((b << 5) + b) ^ (c + i)) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

function finDeviceInfo() {
  const os = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : Platform.OS === "web" ? "Web" : String(Platform.OS);
  const version = String(Platform.Version ?? "");
  return { os: version ? `${os} ${version}` : os, browser: "Studio Suite app", platform: `React Native ${Platform.OS}` };
}

function finTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "local"; }
  catch { return "local"; }
}

/** Recompute the chain end to end; false = the log was tampered with. */
export function finAuditVerify(log: AuditEntry[]) {
  let prev = "genesis";
  for (const e of log) {
    const { hash, ...core } = e;
    if (core.prevHash !== prev || finHash(prev + JSON.stringify(core)) !== hash) return false;
    prev = hash;
  }
  return true;
}

export const finVerifyPassword = (pw: string) => pw === FIN_ADMIN_PASSWORD;

interface AppendArgs { action: AuditAction; ref?: string | null; summary?: string; changes?: FieldChange[] | null; record?: AuditEntry["record"]; ok?: boolean; }

interface FinanceValue {
  settings: FinSettings;
  setSettings: (patch: Partial<FinSettings>) => void;
  expenses: Expense[];
  setExpenses: (updater: (xs: Expense[]) => Expense[]) => void;
  audit: AuditEntry[];
  append: (args: AppendArgs) => void;
  chainIntact: boolean;
}

const FinanceContext = createContext<FinanceValue | null>(null);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<FinSettings>(FIN_SETTINGS_DEFAULT);
  const [expenses, setExpensesState] = useState<Expense[]>(finSeedExpenses);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const setSettings = useCallback((patch: Partial<FinSettings>) => setSettingsState((s) => ({ ...s, ...patch })), []);
  const setExpenses = useCallback((updater: (xs: Expense[]) => Expense[]) => setExpensesState(updater), []);

  // Append-only writer — never exposes an update or delete path.
  const append = useCallback(({ action, ref, summary, changes, record, ok }: AppendArgs) => {
    setAudit((log) => {
      const prev = log.length ? log[log.length - 1].hash : "genesis";
      const core = {
        seq: log.length + 1,
        ts: new Date().toISOString(),
        tz: finTimezone(),
        actor: FIN_AUDIT_ACTOR.name,
        role: FIN_AUDIT_ACTOR.role,
        action, ref: ref ?? null,
        summary: summary ?? "",
        changes: changes ?? null,
        record: record ?? null,
        ok: ok !== false,
        method: "password re-entry",
        device: finDeviceInfo(),
        prevHash: prev,
      };
      return [...log, { ...core, hash: finHash(prev + JSON.stringify(core)) }];
    });
  }, []);

  const value = useMemo<FinanceValue>(
    () => ({ settings, setSettings, expenses, setExpenses, audit, append, chainIntact: finAuditVerify(audit) }),
    [settings, setSettings, expenses, setExpenses, audit, append]
  );
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = (): FinanceValue => {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside FinanceProvider");
  return ctx;
};
