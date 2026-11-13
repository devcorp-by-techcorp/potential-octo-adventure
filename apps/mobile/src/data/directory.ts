/**
 * Studio directory — one index over everyone the studio deals with.
 *
 * Clients = the contact book, plus every enquiry that has not become a contact
 * yet, plus prior-season invoice clients, so past, current and potential are
 * all rows in one index. Partners = the supplier register.
 */
import { buildInvoices, dateShort, STUDIO_TODAY, type Booking, type Contact, type Inquiry } from "./seed";
import { fuzzyBest } from "./enquiry";
import type { Supplier } from "./studio";

export type Stage = "Current" | "Past" | "Potential";
export const STAGES: Stage[] = ["Current", "Past", "Potential"];

export interface ClientRec {
  kind: "contact" | "inquiry" | "invoice"; id: string; name: string; first: string; last: string;
  email: string; phone: string; stage: Stage; letter: string; sortKey: string; meta: string;
}
export interface PartnerRec {
  id: string; name: string; type: string; abn: string; acn: string; email: string; phone: string;
  contact: string; services: string; stage: Stage; letter: string; sortKey: string;
}

/** First and last name. Handles the schedule's "Surname · First" form. */
export function splitName(full: string): { first: string; last: string } {
  const s = (full || "").trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };
  if (s.includes("·")) { const [last, ...rest] = s.split("·"); return { first: rest.join("·").trim(), last: last.trim() }; }
  const parts = s.split(" ");
  // "Nguyen Family", "Beaumont & Co": the trailing word is not the surname.
  while (parts.length > 1 && /^(family|co\.?|&|and|pty|ltd)$/i.test(parts[parts.length - 1])) parts.pop();
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}
const letterOf = (s: string) => ((s || "").match(/[a-z0-9]/i)?.[0] ?? "#").toUpperCase();
const keyOf = (first: string, last: string, name: string) => `${(last || name).toLowerCase()} ${first.toLowerCase()}`;

export function clientRecords(contacts: Contact[], bookings: Booking[], inquiries: Inquiry[]): ClientRec[] {
  const out: ClientRec[] = contacts.map((c) => {
    const b = bookings.find((x) => x.id === c.bookingId) ?? null;
    const { first, last } = splitName(c.name);
    return {
      kind: "contact", id: c.id, name: c.name, first, last, email: c.email, phone: c.phone,
      stage: !b ? "Potential" : b.date < STUDIO_TODAY ? "Past" : "Current",
      letter: letterOf(last || c.name), sortKey: keyOf(first, last, c.name),
      meta: b ? `${b.eventType} · ${dateShort(b.date)}${c.assigned ? " · portal active" : ""}` : "No booking on file",
    };
  });
  const seen = new Set(out.map((r) => r.email.toLowerCase()));
  inquiries.forEach((q) => {
    if (seen.has(q.email.toLowerCase())) return;
    seen.add(q.email.toLowerCase());
    const { first, last } = splitName(q.name);
    out.push({
      kind: "inquiry", id: q.id, name: q.name, first, last, email: q.email, phone: q.phone ?? "", stage: "Potential",
      letter: letterOf(last || q.name), sortKey: keyOf(first, last, q.name), meta: `Enquiry · ${q.type} · ${dateShort(q.date)}`,
    });
  });
  const names = new Set(out.map((r) => r.sortKey));
  buildInvoices([]).filter((i) => i.source === "seed").forEach((i) => {
    const { first, last } = splitName(i.client);
    const sortKey = keyOf(first, last, i.client);
    if (names.has(sortKey)) return;
    names.add(sortKey);
    out.push({
      kind: "invoice", id: i.id, name: i.client, first, last, email: "", phone: "", stage: "Past",
      letter: letterOf(last || i.client), sortKey, meta: `Settled ${dateShort(i.issue)} · ${i.number}`,
    });
  });
  return out;
}

export function partnerRecords(suppliers: Supplier[]): PartnerRec[] {
  return suppliers.map((v) => ({
    id: v.id, name: v.name, type: v.category || "Uncategorised", abn: v.abn, acn: v.acn,
    email: v.email || v.contactEmail, phone: v.phone || v.contactPhone, contact: v.contactName,
    services: v.items.map((i) => i.desc).join(" · "),
    stage: v.prospect ? "Potential" : v.active ? "Current" : "Past",
    letter: letterOf(v.name), sortKey: v.name.toLowerCase(),
  }));
}

export const clientFields = (r: ClientRec) => [r.name, r.first, r.last, r.email, r.phone];
export const partnerFields = (r: PartnerRec) => [r.name, r.type, r.abn, r.acn, r.email, r.phone, r.contact, r.services];

/** Fuzzy-ranked when there is a query; alphabetical otherwise. */
export function rank<T extends { sortKey: string }>(recs: T[], q: string, fields: (r: T) => (string | undefined)[]): T[] {
  if (!q.trim()) return [...recs].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return recs.map((r) => ({ r, s: fuzzyBest(fields(r), q) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.sortKey.localeCompare(b.r.sortKey)).map((x) => x.r);
}

export function groupByLetter<T extends { letter: string; sortKey: string }>(recs: T[]): { letter: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  [...recs].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).forEach((r) => { map.set(r.letter, [...(map.get(r.letter) ?? []), r]); });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, rows]) => ({ letter, rows }));
}
export const lettersOf = (recs: { letter: string }[]) => [...new Set(recs.map((r) => r.letter))].sort();
