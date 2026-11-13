/**
 * Studio records — bookings, enquiries and the contact book, held once and
 * shared by every admin surface and by the public "Begin an enquiry" sheet.
 *
 * An enquiry is a tentative request. The studio moves it through the enquiry
 * state machine; confirming is the single committed change that creates the
 * booking, and it needs a linked client and a free date.
 *
 * In memory for the session, like the rest of the app's state.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { BOOKINGS, INQUIRIES_FULL, CONTACTS, PACKAGES, STUDIO_TODAY, type Booking, type Inquiry, type Contact } from "~/data/seed";
import { INQ_LABELS, canTransition, inqState, type AuditEntry, type InquiryState } from "~/data/enquiry";

/** The collection an accepted inquiry is booked under until the studio changes it, by session type. */
const PACKAGE_FOR: Record<string, string> = { Wedding: "Signature", Editorial: "Signature", Portrait: "Essentials", Family: "Essentials", "Brand / Commercial": "Atelier" };

/** "Astrid Lindqvist" → "Lindqvist · Astrid" (the schedule's surname-first convention). */
export function scheduleName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full.trim();
  const last = parts[parts.length - 1];
  return `${last} · ${parts.slice(0, -1).join(" ")}`;
}

const nextId = (prefix: string, ids: string[]) =>
  prefix + (Math.max(0, ...ids.map((id) => parseInt(id.replace(/\D/g, ""), 10) || 0)) + 1);

/** Build the booking for a confirmed enquiry. Pure. */
export function bookingFromInquiry(q: Inquiry, bookings: Booking[], bookedBy: string): Booking {
  const pkg = PACKAGES.find((p) => p.name === (q.pkg ?? PACKAGE_FOR[q.type] ?? "Signature")) ?? PACKAGES[0];
  return {
    id: nextId("b", bookings.map((b) => b.id)),
    clientName: scheduleName(q.name), eventType: q.type, date: q.date,
    time: "To be confirmed", venue: q.venue?.trim() || "To be confirmed",
    phase: 3, // Date Confirmed
    status: "confirmed", value: pkg.price, pkg: pkg.name, bookedBy,
    notes: q.message,
  };
}

const sameEmail = (a: string, b: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface EnquiryInput { date: string; type: string; pkg: string; name: string; email: string; phone: string; venue: string; message: string; }
export interface ContactInput { name: string; email: string; phone: string; tags: string[]; }
export type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

interface RecordsValue {
  bookings: Booking[];
  inquiries: Inquiry[];
  contacts: Contact[];
  /** Enquiries still awaiting studio review (tentative requests). */
  newInquiryCount: number;
  /** Dates that already carry a confirmed booking — unavailable on the public calendar. */
  confirmedDates: Set<string>;
  /** The contact an enquiry is linked to (matched on email), if any. */
  clientFor: (q: Inquiry) => Contact | null;
  /** Public "Begin an enquiry": files a tentative request and returns its reference. */
  submitEnquiry: (e: EnquiryInput) => string;
  /**
   * Move an enquiry through the state machine. Only allowed transitions apply.
   * Confirming needs a linked client and a date with no confirmed booking, and
   * creates the booking. Every change is appended to the enquiry's audit trail.
   */
  transitionInquiry: (id: string, to: InquiryState, actor: string, bookedBy: string) => Result<{ bookingId?: string }>;
  addContact: (c: ContactInput) => Result<{ id: string }>;
  /** Add the person behind an enquiry to the contact book, linking the two. */
  addContactFromInquiry: (id: string) => Result<{ id: string }>;
  toggleContactAssigned: (id: string) => void;
  setBookingPhase: (id: string, phase: number) => void;
}

const Ctx = createContext<RecordsValue | null>(null);
type State = { bookings: Booking[]; inquiries: Inquiry[]; contacts: Contact[] };

export const RecordsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>({ bookings: BOOKINGS, inquiries: INQUIRIES_FULL, contacts: CONTACTS });

  const submitEnquiry = useCallback((e: EnquiryInput) => {
    const ref = "ENQ-" + (3100 + state.inquiries.length);
    const extra = [e.venue.trim() ? `Venue: ${e.venue.trim()}` : "", e.phone.trim() ? `Phone: ${e.phone.trim()}` : "", `Collection of interest: ${e.pkg}`].filter(Boolean).join(" · ");
    const q: Inquiry = {
      id: nextId("q", state.inquiries.map((x) => x.id)), name: e.name.trim(), email: e.email.trim(),
      date: e.date, type: e.type, receivedAt: STUDIO_TODAY, status: "tentative_request", audit: [],
      message: `${e.message.trim() || "Began an enquiry through the studio site."} — ${extra}`,
      ref, source: "Studio site · Begin an enquiry", phone: e.phone.trim(), venue: e.venue.trim(), pkg: e.pkg,
    };
    setState((s) => ({ ...s, inquiries: [q, ...s.inquiries] }));
    return ref;
  }, [state.inquiries]);

  const transitionInquiry = useCallback((id: string, to: InquiryState, actor: string, bookedBy: string): Result<{ bookingId?: string }> => {
    const q = state.inquiries.find((x) => x.id === id);
    if (!q) return { ok: false, error: "That enquiry no longer exists." };
    const from = inqState(q);
    if (!canTransition(from, to)) return { ok: false, error: `Not allowed from ${INQ_LABELS[from]}.` };
    let booking: Booking | null = null;
    let client: Contact | null = null;
    if (to === "confirmed") {
      client = state.contacts.find((c) => sameEmail(c.email, q.email)) ?? null;
      if (!client) return { ok: false, error: `A linked client is required — add ${q.name} to Contacts first.` };
      if (state.bookings.some((b) => b.date === q.date && b.status === "confirmed")) return { ok: false, error: "That date already has a confirmed booking." };
      booking = bookingFromInquiry(q, state.bookings, bookedBy);
    }
    const entry: AuditEntry = { at: STUDIO_TODAY, actor, from, to };
    setState((s) => {
      const cur = s.inquiries.find((x) => x.id === id);
      if (!cur || inqState(cur) !== from) return s; // already moved on
      return {
        bookings: booking ? [...s.bookings, booking] : s.bookings,
        // A client with no booking on file is linked to the one just created.
        contacts: booking && client ? s.contacts.map((c) => (c.id === client!.id && !c.bookingId ? { ...c, bookingId: booking!.id } : c)) : s.contacts,
        inquiries: s.inquiries.map((x) => (x.id === id ? { ...x, status: to, audit: [...(x.audit ?? []), entry] } : x)),
      };
    });
    return { ok: true, bookingId: booking?.id };
  }, [state]);

  const addContact = useCallback((c: ContactInput): Result<{ id: string }> => {
    const name = c.name.trim(), email = c.email.trim();
    if (!name) return { ok: false, error: "A name is required." };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "A valid email is required." };
    if (state.contacts.some((x) => sameEmail(x.email, email))) return { ok: false, error: "That email is already in the contact book." };
    const id = nextId("c", state.contacts.map((x) => x.id));
    setState((s) => ({ ...s, contacts: [...s.contacts, { id, name, email, phone: c.phone.trim(), bookingId: "", assigned: false, tags: c.tags }] }));
    return { ok: true, id };
  }, [state.contacts]);

  const addContactFromInquiry = useCallback((id: string): Result<{ id: string }> => {
    const q = state.inquiries.find((x) => x.id === id);
    if (!q) return { ok: false, error: "That enquiry no longer exists." };
    return addContact({ name: q.name, email: q.email, phone: q.phone ?? "", tags: ["Prospect"] });
  }, [state.inquiries, addContact]);

  const toggleContactAssigned = useCallback((id: string) =>
    setState((s) => ({ ...s, contacts: s.contacts.map((c) => (c.id === id ? { ...c, assigned: !c.assigned } : c)) })), []);

  const setBookingPhase = useCallback((id: string, phase: number) =>
    setState((s) => ({ ...s, bookings: s.bookings.map((b) => (b.id === id ? { ...b, phase } : b)) })), []);

  const value = useMemo<RecordsValue>(() => ({
    ...state,
    newInquiryCount: state.inquiries.filter((q) => inqState(q) === "tentative_request").length,
    confirmedDates: new Set(state.bookings.filter((b) => b.status === "confirmed").map((b) => b.date)),
    clientFor: (q) => state.contacts.find((c) => sameEmail(c.email, q.email)) ?? null,
    submitEnquiry, transitionInquiry, addContact, addContactFromInquiry, toggleContactAssigned, setBookingPhase,
  }), [state, submitEnquiry, transitionInquiry, addContact, addContactFromInquiry, toggleContactAssigned, setBookingPhase]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useRecords(): RecordsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecords must be used inside <RecordsProvider>");
  return v;
}
