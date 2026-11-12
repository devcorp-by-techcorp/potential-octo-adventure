/**
 * Studio records — bookings, inquiries and the contact book, held once and
 * shared by every admin surface (Dashboard, Bookings, Inquiries, Shoot Tracker,
 * Contacts, Documents, Finance, the nav badge and Luma's greeting).
 *
 * Accepting an inquiry is a single committed change: the booking is created,
 * the client joins the contact book if they are new, and the inquiry leaves the
 * open list — in that order, in one update, so no screen can see half of it.
 *
 * In memory for the session, like the rest of the app's state.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { BOOKINGS, INQUIRIES_FULL, CONTACTS, PACKAGES, type Booking, type Inquiry, type Contact } from "~/data/seed";

/** The collection an accepted inquiry is booked under until the studio changes it, by session type. */
const PACKAGE_FOR: Record<string, string> = { Wedding: "Signature", Editorial: "Signature", Portrait: "Essentials", Family: "Essentials" };

/** "Astrid Lindqvist" → "Lindqvist · Astrid" (the schedule's surname-first convention). */
export function scheduleName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full.trim();
  const last = parts[parts.length - 1];
  return `${last} · ${parts.slice(0, -1).join(" ")}`;
}

const nextId = (prefix: string, ids: string[]) =>
  prefix + (Math.max(0, ...ids.map((id) => parseInt(id.replace(/\D/g, ""), 10) || 0)) + 1);

/** Build the booking, and the contact if the client is new, for an accepted inquiry. Pure. */
export function bookingFromInquiry(q: Inquiry, bookings: Booking[], contacts: Contact[], bookedBy: string): { booking: Booking; contact: Contact | null } {
  const pkg = PACKAGES.find((p) => p.name === (PACKAGE_FOR[q.type] ?? "Signature")) ?? PACKAGES[0];
  const booking: Booking = {
    id: nextId("b", bookings.map((b) => b.id)),
    clientName: scheduleName(q.name), eventType: q.type, date: q.date,
    time: "To be confirmed", venue: "To be confirmed",
    phase: 1, // Agreement Sent — accepting sends the agreement
    status: "pending", value: pkg.price, pkg: pkg.name, bookedBy,
    notes: q.message,
  };
  const known = contacts.some((c) => c.email.toLowerCase() === q.email.toLowerCase());
  const contact: Contact | null = known ? null : {
    id: nextId("c", contacts.map((c) => c.id)), name: q.name, email: q.email, phone: "", bookingId: booking.id, assigned: false, tags: [],
  };
  return { booking, contact };
}

interface RecordsValue {
  bookings: Booking[];
  inquiries: Inquiry[];
  contacts: Contact[];
  /** Inquiries still awaiting the studio (status "new"). */
  newInquiryCount: number;
  /** Creates the booking (and contact) and closes the inquiry. Returns the new booking id, or null if the inquiry was not open. */
  acceptInquiry: (id: string, bookedBy: string) => string | null;
  declineInquiry: (id: string) => void;
  setBookingPhase: (id: string, phase: number) => void;
}

const Ctx = createContext<RecordsValue | null>(null);
const OPEN = new Set(["new", "reviewing"]);

export const RecordsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState({ bookings: BOOKINGS, inquiries: INQUIRIES_FULL, contacts: CONTACTS });

  const acceptInquiry = useCallback((id: string, bookedBy: string) => {
    const q = state.inquiries.find((x) => x.id === id);
    if (!q || !OPEN.has(q.status)) return null;
    const { booking, contact } = bookingFromInquiry(q, state.bookings, state.contacts, bookedBy);
    setState((s) => {
      if (!s.inquiries.some((x) => x.id === id && OPEN.has(x.status))) return s; // already handled
      return {
        bookings: [...s.bookings, booking],
        contacts: contact ? [...s.contacts, contact] : s.contacts,
        inquiries: s.inquiries.map((x) => (x.id === id ? { ...x, status: "accepted" } : x)),
      };
    });
    return booking.id;
  }, [state]);

  const declineInquiry = useCallback((id: string) =>
    setState((s) => ({ ...s, inquiries: s.inquiries.map((x) => (x.id === id && OPEN.has(x.status) ? { ...x, status: "declined" } : x)) })), []);

  const setBookingPhase = useCallback((id: string, phase: number) =>
    setState((s) => ({ ...s, bookings: s.bookings.map((b) => (b.id === id ? { ...b, phase } : b)) })), []);

  const value = useMemo<RecordsValue>(() => ({
    ...state,
    newInquiryCount: state.inquiries.filter((q) => q.status === "new").length,
    acceptInquiry, declineInquiry, setBookingPhase,
  }), [state, acceptInquiry, declineInquiry, setBookingPhase]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useRecords(): RecordsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRecords must be used inside <RecordsProvider>");
  return v;
}
