/**
 * Enquiry state machine — shared by Illuminate Studios and Illuminate Kids.
 * Mirrors the studio backend's domain rules: an enquiry is a tentative request,
 * the studio moves it only through allowed transitions, and nothing is booked
 * or held until the studio confirms.
 */
export type InquiryState =
  | "tentative_request" | "awaiting_studio_confirmation" | "awaiting_client_confirmation"
  | "confirmed" | "needs_human" | "abandoned";

export interface AuditEntry { at: string; actor: string; from: InquiryState; to: InquiryState; }

/** Statuses stored before the state machine existed map onto it on read. */
const LEGACY_STATE: Record<string, InquiryState> = {
  new: "tentative_request", reviewing: "awaiting_studio_confirmation", replied: "awaiting_studio_confirmation",
  booked: "confirmed", accepted: "confirmed", declined: "abandoned",
};
export const INQ_LABELS: Record<InquiryState, string> = {
  tentative_request: "Tentative request",
  awaiting_studio_confirmation: "Awaiting studio",
  awaiting_client_confirmation: "Awaiting client",
  confirmed: "Confirmed",
  needs_human: "Needs a human",
  abandoned: "Closed",
};
export const INQ_FLOW: Partial<Record<InquiryState, InquiryState[]>> = {
  tentative_request: ["awaiting_studio_confirmation", "needs_human", "abandoned"],
  awaiting_studio_confirmation: ["awaiting_client_confirmation", "confirmed", "needs_human", "abandoned"],
  awaiting_client_confirmation: ["confirmed", "needs_human", "abandoned"],
  needs_human: ["awaiting_studio_confirmation", "abandoned"],
};
/** What the person who enquired is told in each state. */
export const INQ_MESSAGES: Record<InquiryState, string> = {
  tentative_request: "Your tentative request has been received for studio review.",
  awaiting_studio_confirmation: "Your request is awaiting studio confirmation.",
  awaiting_client_confirmation: "The studio is awaiting your confirmation.",
  confirmed: "Your booking is confirmed.",
  needs_human: "A studio team member needs to review your request.",
  abandoned: "This request is no longer active.",
};
export const inqState = (q: { status: string }): InquiryState =>
  LEGACY_STATE[q.status] ?? (q.status in INQ_LABELS ? (q.status as InquiryState) : "tentative_request");
export const canTransition = (from: InquiryState, to: InquiryState) => (INQ_FLOW[from] ?? []).includes(to);
/** The studio's label for moving an enquiry into `to` from `from`. */
export const transitionLabel = (from: InquiryState, to: InquiryState, other = "client", confirm = "Confirm booking"): string =>
  ({
    awaiting_studio_confirmation: from === "needs_human" ? "Return to review" : "Take into review",
    awaiting_client_confirmation: `Ask ${other} to confirm`,
    confirmed: confirm,
    needs_human: "Flag for a human",
    abandoned: "Close request",
    tentative_request: "Reopen",
  })[to];
export const inqTone = (s: InquiryState): "success" | "gold" | "muted" | "warning" =>
  s === "confirmed" ? "success" : s === "tentative_request" ? "gold" : s === "abandoned" ? "muted" : "warning";

/** Subsequence fuzzy score over one string: prefix > substring > in-order letters. 0 = no match. */
export function fuzzyScore(hay: string, q: string): number {
  const h = (hay || "").toLowerCase(), n = (q || "").toLowerCase();
  if (!n) return 1;
  if (!h) return 0;
  const i = h.indexOf(n);
  if (i === 0) return 1000;
  if (i > 0) return 800 - Math.min(i, 90);
  let at = 0, score = 0, run = 0;
  for (let k = 0; k < n.length; k++) {
    const f = h.indexOf(n[k], at);
    if (f < 0) return 0;
    run = f === at ? run + 1 : 0;
    score += 8 + run * 3;
    at = f + 1;
  }
  return Math.min(score, 600);
}
/** Best score across fields. A query with 3+ digits also matches numbers ignoring spaces and punctuation (phone, ABN, ACN). */
export function fuzzyBest(fields: (string | undefined)[], q: string): number {
  const n = (q || "").trim();
  if (!n) return 1;
  const digits = n.replace(/\D/g, "");
  // A local number typed with its leading 0 also matches the same number stored as +61….
  const local = digits.startsWith("0") ? digits.slice(1) : "";
  let best = 0;
  fields.forEach((f) => {
    const v = f || "";
    if (!v) return;
    best = Math.max(best, fuzzyScore(v, n));
    const vd = v.replace(/\D/g, "");
    if (digits.length >= 3 && (vd.includes(digits) || (local.length >= 3 && vd.includes(local))) && best < 900) best = 900;
  });
  return best;
}
/** Which labelled field matched best, so a phone search shows the number rather than repeating the name. */
export function fuzzyHint(pairs: [string, string | undefined][], q: string): string {
  let best = 0, out = "";
  pairs.forEach(([label, v]) => { if (!v) return; const s = fuzzyBest([v], q); if (s > best) { best = s; out = `${label} · ${v}`; } });
  return out;
}
