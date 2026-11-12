/**
 * Illuminate Kids state — one store read and written by the public Kids site,
 * the organisation portal, parent registration and the studio's Kids workspace.
 *
 * Mounted at the root so a public enquiry lands in the studio's Kids Inquiries,
 * a parent's registration shows in the organisation's roster, and a phase the
 * studio sets is what the organisation's tracker reads.
 *
 * Like the rest of the app's state this lives in memory for the session; real
 * persistence belongs to the backend.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  seedKidsDb, seedKidsInquiries, seedKidsBookings, seedKidsInvoices, seedKidsExpenses,
  inqState, INQ_FLOW, commitRegistration, todayIso,
  type KidsDb, type KidsInquiry, type KidsBooking, type KidsInvoice, type KidsExpense,
  type KidsGroup, type GroupKind, type GroupStaff, type InquiryState, type RegistrationInput,
} from "~/data/kids";

interface KidsValue {
  db: KidsDb;
  inquiries: KidsInquiry[];
  bookings: KidsBooking[];
  invoices: KidsInvoice[];
  expenses: KidsExpense[];
  // public
  submitEnquiry: (e: { org: string; type: string; count: string; dates: string; name: string; email: string }) => void;
  // organisation portal
  addGroup: (orgId: string, g: { name: string; kind: GroupKind; lead: string; leadRole: string }) => string;
  addStaff: (groupId: string, s: GroupStaff) => void;
  removeStaff: (groupId: string, index: number) => void;
  addStudent: (groupId: string, first: string, last: string) => void;
  removeStudent: (groupId: string, rosterId: string) => void;
  markRead: (orgId: string, msgId: string) => void;
  reply: (orgId: string, msgId: string, text: string) => void;
  signDoc: (orgId: string, docId: string) => void;
  // parent
  register: (input: RegistrationInput) => string;
  // studio
  setPhase: (orgId: string, phase: number) => void;
  transition: (inquiryId: string, to: InquiryState, actor: string) => void;
  markPaid: (invoiceId: string) => void;
  reset: () => void;
}

const KidsCtx = createContext<KidsValue | null>(null);

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const KidsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<KidsDb>(seedKidsDb);
  const [inquiries, setInquiries] = useState<KidsInquiry[]>(seedKidsInquiries);
  const [bookings] = useState<KidsBooking[]>(seedKidsBookings);
  const [invoices, setInvoices] = useState<KidsInvoice[]>(seedKidsInvoices);
  const [expenses] = useState<KidsExpense[]>(seedKidsExpenses);

  const updGroup = useCallback((groupId: string, fn: (g: KidsGroup) => KidsGroup) =>
    setDb((d) => ({ ...d, groups: d.groups.map((g) => (g.id === groupId ? fn(g) : g)) })), []);

  const value = useMemo<KidsValue>(() => ({
    db, inquiries, bookings, invoices, expenses,

    submitEnquiry: (e) => setInquiries((list) => [{
      id: nid("ki"), org: e.org.trim(), type: e.type || "Other", count: e.count.trim(), dates: e.dates.trim(),
      name: e.name.trim(), email: e.email.trim(), received: todayIso(),
      status: "tentative_request", audit: [], source: "Illuminate Kids · enquiry form",
    }, ...list]),

    addGroup: (orgId, g) => {
      const id = nid("g");
      setDb((d) => ({ ...d, groups: [...d.groups, { id, orgId, name: g.name.trim(), kind: g.kind, lead: g.lead.trim(), leadRole: g.leadRole, staff: [], roster: [] }] }));
      return id;
    },
    addStaff: (groupId, s) => updGroup(groupId, (g) => ({ ...g, staff: [...g.staff, s] })),
    removeStaff: (groupId, index) => updGroup(groupId, (g) => ({ ...g, staff: g.staff.filter((_, i) => i !== index) })),
    addStudent: (groupId, first, last) =>
      updGroup(groupId, (g) => ({ ...g, roster: [...g.roster, { id: nid("r"), first: first.trim(), last: last.trim(), childId: null }] })),
    // A registered child's entry is never removable by the organisation.
    removeStudent: (groupId, rosterId) =>
      updGroup(groupId, (g) => ({ ...g, roster: g.roster.filter((r) => r.id !== rosterId || r.childId) })),
    markRead: (orgId, msgId) =>
      setDb((d) => ({ ...d, inbox: { ...d.inbox, [orgId]: (d.inbox[orgId] ?? []).map((m) => (m.id === msgId ? { ...m, read: true } : m)) } })),
    reply: (orgId, msgId, text) =>
      setDb((d) => ({ ...d, inbox: { ...d.inbox, [orgId]: (d.inbox[orgId] ?? []).map((m) => (m.id === msgId ? { ...m, thread: [...m.thread, { text }] } : m)) } })),
    signDoc: (orgId, docId) =>
      setDb((d) => ({ ...d, docs: { ...d.docs, [orgId]: (d.docs[orgId] ?? []).map((x) => (x.id === docId && x.status === "To sign" ? { ...x, status: "Signed" } : x)) } })),

    register: (input) => {
      const out = commitRegistration(db, input);
      setDb(out.db);
      return out.guardianId;
    },

    setPhase: (orgId, phase) =>
      setDb((d) => (d.shoots[orgId] ? { ...d, shoots: { ...d.shoots, [orgId]: { ...d.shoots[orgId], phase } } } : d)),
    // Only transitions the state machine allows are applied; each appends to the audit trail.
    transition: (inquiryId, to, actor) => setInquiries((list) => list.map((q) => {
      if (q.id !== inquiryId) return q;
      const from = inqState(q);
      if (!(INQ_FLOW[from] ?? []).includes(to)) return q;
      return { ...q, status: to, audit: [...q.audit, { at: todayIso(), actor, from, to }] };
    })),
    markPaid: (invoiceId) => setInvoices((list) => list.map((i) => (i.id === invoiceId ? { ...i, status: "Paid" } : i))),

    reset: () => { setDb(seedKidsDb()); setInquiries(seedKidsInquiries()); setInvoices(seedKidsInvoices()); },
  }), [db, inquiries, bookings, invoices, expenses, updGroup]);

  return <KidsCtx.Provider value={value}>{children}</KidsCtx.Provider>;
};

export function useKids(): KidsValue {
  const v = useContext(KidsCtx);
  if (!v) throw new Error("useKids must be used inside <KidsProvider>");
  return v;
}
