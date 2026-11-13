/**
 * Illuminate Kids — records, seeds and rules shared by the public Kids site, the
 * organisation portal, parent registration and the studio's Kids workspace.
 *
 * Governance rules encoded here:
 *  - Every consent option defaults to off; a child with no consent is excluded
 *    from all photos.
 *  - Studio staff see a child's name and unique number only once a guardian has
 *    completed registration. Until then a roster entry is a count, not a name.
 *  - Name matching and sibling linking never cross organisations.
 *  - Enquiries follow the studio's tentative-request state machine: nothing is
 *    booked or held until the studio confirms.
 */

// ── Palette (Illuminate neutrals + two playful accents) ───────────────────
export const K = {
  ground: "#f7f1e6",
  card: "#fffdf8",
  panel: "#ece3d2",
  panelSoft: "#efe6d6",
  ink: "#16130e",
  body: "#4a4338",
  muted: "#5c5446",
  faint: "#6e6556",
  green: "#8FBF6A",
  greenTint: "#e6eed9",
  greenLink: "#3f6b27",
  gold: "#F2B544",
  goldTint: "#fbeccb",
  error: "#8a2b12",
  errorBg: "#fbe3dc",
  dark: "#0a0a0a",
  darkPanel: "#221e17",
  cream: "#f4ebd9",
  champagne: "#c9a96e",
  line: "rgba(22,19,14,0.14)",
  lineStrong: "rgba(22,19,14,0.18)",
  white: "#ffffff",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────
export type GroupKind = "Class" | "Team" | "Group";
export type ConsentKey = "portrait" | "group" | "sibling" | "yearbook" | "marketing";
export type Consent = Partial<Record<ConsentKey, boolean>>;

export interface KidsOrg { id: string; name: string; type: string; code: string; manager: string; managerRole: string; }
export interface GroupStaff { name: string; role: string; }
export interface RosterEntry { id: string; first: string; last: string; childId: string | null; }
export interface KidsGroup { id: string; orgId: string; name: string; kind: GroupKind; lead: string; leadRole: string; staff: GroupStaff[]; roster: RosterEntry[]; }
export interface KidsChild { id: string; uid: string; first: string; last: string; year: string; guardianId: string; consent: Consent; famId?: string | null; groupIds: string[]; }
export interface Guardian { id: string; name: string; email: string; phone: string; g2: { name: string; email: string } | null; }
export interface KidsShoot { label: string; date: string; phase: number; }
export interface OrgMessage { id: string; subject: string; date: string; read: boolean; body: string; thread: { text: string }[]; }
export interface OrgDoc { id: string; title: string; kind: string; status: "To sign" | "Signed" | "Reference" | "Draft"; }

export interface KidsDb {
  orgs: KidsOrg[];
  groups: KidsGroup[];
  children: KidsChild[];
  guardians: Guardian[];
  shoots: Record<string, KidsShoot>;
  inbox: Record<string, OrgMessage[]>;
  docs: Record<string, OrgDoc[]>;
}

export interface KidsInquiry {
  id: string; org: string; type: string; count: string; dates: string; name: string; email: string;
  received: string; status: string; audit: AuditEntry[]; source: string;
}

export interface KidsBooking { id: string; orgId: string; iso: string; children: number; value: number; status: "Confirmed" | "Pencilled"; }
export interface KidsInvoice { id: string; orgId: string; issued: string; due: string; amount: number; status: "Paid" | "Sent" | "Overdue"; }
export interface KidsExpense { id: string; iso: string; supplier: string; desc: string; amount: number; }

// ── Constants ─────────────────────────────────────────────────────────────
export const KIDS_PHASES = ["Booked", "Registrations open", "Shoot day", "Editing", "Galleries live"];
export const STAFF_ROLES = ["Teacher", "Educator", "Coach", "Assistant coach", "Education support", "Team manager", "Other"];
export const GROUP_KINDS: GroupKind[] = ["Class", "Team", "Group"];
export const KIND_BG: Record<GroupKind, string> = { Class: K.greenTint, Team: K.goldTint, Group: K.panelSoft };

export const TIERS: { k: ConsentKey; label: string; sub: string }[] = [
  { k: "portrait", label: "Individual portrait", sub: "A portrait of your child on their own." },
  { k: "group", label: "Class / group photo", sub: "Your child appears in their class, group or team photo." },
  { k: "sibling", label: "Sibling photo", sub: "Your child is photographed with their registered siblings." },
  { k: "yearbook", label: "Yearbook and organisation publications", sub: "The organisation may use photos in its yearbook, newsletter or noticeboard." },
  { k: "marketing", label: "Illuminate marketing", sub: "Illuminate Studios may use photos to promote its work. Off unless you choose it." },
];

export const ORG_TYPES = ["Early childhood centres", "Kinders and kindergartens", "Primary schools", "Secondary schools", "Sports clubs", "Dance and performing arts"];
export const ENQUIRY_TYPES = ["Early childhood centre", "Kinder / kindergarten", "Primary school", "Secondary school", "Sports club", "Dance / performing arts", "Other"];
export const REGISTRATION_STEPS = [
  { title: "Registrations open", body: "Your organisation lets parents know registrations are open." },
  { title: "You get a code", body: "Each parent receives a unique code linked to their child's organisation." },
  { title: "Register each child", body: "Add your child or children, their room, class or team, and link siblings." },
  { title: "Choose your consent", body: "Pick exactly what you agree to for each child. Only consented children are photographed." },
];

// ── Enquiry state machine (shared with the studio; see ./enquiry) ─────────
export { INQ_LABELS, INQ_FLOW, INQ_MESSAGES, inqState } from "./enquiry";
import { transitionLabel as sharedTransitionLabel, type InquiryState, type AuditEntry } from "./enquiry";
export type { InquiryState, AuditEntry };
/** Kids wording: the other party is an organisation and a confirmation is a photo day. */
export const transitionLabel = (from: InquiryState, to: InquiryState) => sharedTransitionLabel(from, to, "organisation", "Confirm photo day");

// ── Seeds ─────────────────────────────────────────────────────────────────
const roster = (gid: string, names: string[], reg: Record<string, string> = {}): RosterEntry[] =>
  names.map((n, i) => {
    const [first, ...rest] = n.split(" ");
    return { id: `${gid}-${i}`, first, last: rest.join(" "), childId: reg[n] ?? null };
  });

export function seedKidsDb(): KidsDb {
  return {
    orgs: [
      { id: "o1", name: "Northcote Primary School", type: "Primary school", code: "ILK-7305", manager: "Dana Whitfield", managerRole: "Business Manager" },
      { id: "o2", name: "Merri Creek Junior Football Club", type: "Sports club", code: "ILK-2190", manager: "Sam Okafor", managerRole: "Club Secretary" },
      { id: "o3", name: "Little Wattle Early Learning", type: "Early childhood centre", code: "ILK-4821", manager: "Priya Nair", managerRole: "Centre Director" },
    ],
    groups: [
      { id: "g1", orgId: "o1", name: "Prep A", kind: "Class", lead: "Ms Hannah Lee", leadRole: "Teacher", staff: [{ name: "Mr Tom Reid", role: "Education support" }], roster: roster("g1", ["Mia Thompson", "Leo Nguyen", "Ava Patel", "Noah Kelly", "Isla Brown"]) },
      { id: "g2", orgId: "o1", name: "3B", kind: "Class", lead: "Mr James Carter", leadRole: "Teacher", staff: [], roster: roster("g2", ["Oliver Thompson", "Ruby Singh", "Jack Wilson", "Zoe Martin"], { "Ruby Singh": "c1" }) },
      { id: "g3", orgId: "o1", name: "Junior Netball", kind: "Team", lead: "Ms Kate Morgan", leadRole: "Coach", staff: [{ name: "Ms Erin Shaw", role: "Assistant coach" }], roster: roster("g3", ["Ruby Singh", "Zoe Martin", "Ella Davies"], { "Ruby Singh": "c1" }) },
      { id: "g4", orgId: "o1", name: "School Choir", kind: "Group", lead: "Mrs Ana Silva", leadRole: "Teacher", staff: [], roster: roster("g4", ["Oliver Thompson", "Ava Patel"]) },
      { id: "g5", orgId: "o2", name: "Under 9 Magpies", kind: "Team", lead: "Ben Harris", leadRole: "Coach", staff: [{ name: "Lily Chen", role: "Assistant coach" }, { name: "Mark Doyle", role: "Team manager" }], roster: roster("g5", ["Oliver Thompson", "Jack Wilson", "Sam Rossi"]) },
      { id: "g6", orgId: "o3", name: "Wombats Room", kind: "Group", lead: "Ms Grace Ahmed", leadRole: "Educator", staff: [], roster: roster("g6", ["Charlie Thompson", "Sophie Lee"]) },
    ],
    children: [{ id: "c1", uid: "IK-482913", first: "Ruby", last: "Singh", year: "Year 3", guardianId: "p1", consent: { portrait: true, group: true, yearbook: true }, groupIds: ["g2", "g3"] }],
    guardians: [{ id: "p1", name: "Harpreet Singh", email: "harpreet.singh@example.com", phone: "", g2: null }],
    shoots: {
      o1: { label: "Whole-school photo day", date: "Thu 3 Dec 2026", phase: 1 },
      o2: { label: "Season team photos", date: "Sat 13 Feb 2027", phase: 0 },
      o3: { label: "Centre portrait day", date: "Thu 26 Nov 2026", phase: 1 },
    },
    inbox: {
      o1: [
        { id: "m1", subject: "Registrations are ready to open", date: "9 Nov", read: false, body: "Your linking code is active. Once every class, group and team is set up, share the code with parents so they can register and give consent before photo day.", thread: [] },
        { id: "m2", subject: "Photo day run sheet", date: "4 Nov", read: true, body: "We have added a draft run sheet to Docs. Let us know if any class times need to move.", thread: [] },
      ],
      o2: [{ id: "m3", subject: "Welcome to Illuminate Kids", date: "2 Nov", read: false, body: "Set up each team and its coaches, then share your linking code with families when you are ready to open registrations.", thread: [] }],
      o3: [{ id: "m4", subject: "Portrait day confirmed", date: "28 Oct", read: true, body: "Your portrait day is confirmed for Thursday 26 November. Registrations are open.", thread: [] }],
    },
    docs: {
      o1: [{ id: "d1", title: "Service agreement", kind: "Agreement", status: "To sign" }, { id: "d2", title: "Child safety and image handling policy", kind: "Policy", status: "Reference" }, { id: "d3", title: "Photo day run sheet", kind: "Schedule", status: "Draft" }],
      o2: [{ id: "d4", title: "Service agreement", kind: "Agreement", status: "To sign" }, { id: "d5", title: "Child safety and image handling policy", kind: "Policy", status: "Reference" }],
      o3: [{ id: "d6", title: "Service agreement", kind: "Agreement", status: "Signed" }, { id: "d7", title: "Child safety and image handling policy", kind: "Policy", status: "Reference" }],
    },
  };
}

export const seedKidsInquiries = (): KidsInquiry[] => [
  { id: "ki1", org: "St Brigid's Catholic Primary", type: "Primary school", count: "320", dates: "Term 1, March 2027", name: "Louise Farrell", email: "office@stbrigids.example.edu.au", received: "2026-11-09", status: "tentative_request", audit: [], source: "Illuminate Kids · enquiry form" },
  { id: "ki2", org: "Fitzroy Dance Academy", type: "Dance / performing arts", count: "85", dates: "Early December, before the concert", name: "Marco Bellini", email: "marco@fitzroydance.example.com", received: "2026-11-06", status: "tentative_request", audit: [], source: "Illuminate Kids · Luma chat" },
  { id: "ki3", org: "Brunswick Kinder", type: "Kinder / kindergarten", count: "44", dates: "February 2027", name: "Jo Tran", email: "jo@brunswickkinder.example.org.au", received: "2026-10-28", status: "awaiting_studio_confirmation", audit: [{ at: "2026-10-30", actor: "Victoria Caine", from: "tentative_request", to: "awaiting_studio_confirmation" }], source: "Illuminate Kids · enquiry form" },
];

export const seedKidsBookings = (): KidsBooking[] => [
  { id: "kb1", orgId: "o3", iso: "2026-11-26", children: 42, value: 2400, status: "Confirmed" },
  { id: "kb2", orgId: "o1", iso: "2026-12-03", children: 410, value: 9800, status: "Confirmed" },
  { id: "kb3", orgId: "o2", iso: "2027-02-13", children: 96, value: 3100, status: "Pencilled" },
];
export const seedKidsInvoices = (): KidsInvoice[] => [
  { id: "KI-1004", orgId: "o3", issued: "2026-10-28", due: "2026-11-27", amount: 1200, status: "Paid" },
  { id: "KI-1005", orgId: "o1", issued: "2026-11-04", due: "2026-12-04", amount: 4900, status: "Sent" },
  { id: "KI-1006", orgId: "o2", issued: "2026-10-01", due: "2026-10-31", amount: 900, status: "Overdue" },
];
export const seedKidsExpenses = (): KidsExpense[] => [
  { id: "ke1", iso: "2026-11-02", supplier: "Momento Pro", desc: "Class photo prints · proof run", amount: 286 },
  { id: "ke2", iso: "2026-10-20", supplier: "Officeworks", desc: "Consent cards and lanyards", amount: 118 },
  { id: "ke3", iso: "2026-10-11", supplier: "Rental Camera Co", desc: "Backdrop stand hire", amount: 165 },
];

// ── Derivations ───────────────────────────────────────────────────────────
export const norm = (s: string) => (s || "").trim().toLowerCase();
export const fullName = (p: { first: string; last: string }) => `${p.first} ${p.last}`.trim();
export const registeredCount = (g: KidsGroup) => g.roster.filter((r) => r.childId).length;
export const groupLabel = (g: KidsGroup) => `${g.name} · ${g.lead}`;
export const EMAIL_RE = /\S+@\S+\.\S+/;

export function orgStats(db: KidsDb, orgId: string) {
  const gs = db.groups.filter((g) => g.orgId === orgId);
  return {
    groups: gs.length,
    registered: gs.reduce((n, g) => n + registeredCount(g), 0),
    total: gs.reduce((n, g) => n + g.roster.length, 0),
  };
}

/** A guardian's registered children at one organisation (siblings may sit in different groups). */
export function guardianKidsAt(db: KidsDb, guardianId: string | null, orgId: string): KidsChild[] {
  if (!guardianId) return [];
  return db.children.filter((c) => c.guardianId === guardianId &&
    c.groupIds.some((id) => db.groups.find((g) => g.id === id)?.orgId === orgId));
}

export const siblingsOf = (db: KidsDb, c: KidsChild): KidsChild[] =>
  c.famId ? db.children.filter((x) => x.famId === c.famId && x.id !== c.id) : [];

/** Consent summary. The sibling tier only counts once the child is sibling-linked. */
export function consentSummary(consent: Consent, siblingLinked: boolean): { text: string; excluded: boolean } {
  const on = TIERS.filter((t) => consent[t.k] && (t.k !== "sibling" || siblingLinked));
  return on.length
    ? { text: "Consent: " + on.map((t) => t.label).join(", "), excluded: false }
    : { text: "Excluded from all photos", excluded: true };
}

// ── Parent registration ───────────────────────────────────────────────────
export interface DraftChild { groupId: string; first: string; last: string; year: string; consent: Consent; }
export const blankDraftChild = (): DraftChild => ({ groupId: "", first: "", last: "", year: "", consent: {} });

export interface GroupMatch { key: string; childIndex: number; groupId: string; rosterId: string; }

/**
 * Other groups in the SAME organisation whose roster carries an unregistered
 * entry with the same first and last name. Offered to the parent for explicit
 * permission; nothing is linked without it.
 */
export function findGroupMatches(db: KidsDb, orgId: string, kids: DraftChild[]): GroupMatch[] {
  const out: GroupMatch[] = [];
  kids.forEach((k, childIndex) => db.groups.forEach((g) => {
    if (g.id === k.groupId || g.orgId !== orgId) return;
    const r = g.roster.find((x) => !x.childId && norm(x.first) === norm(k.first) && norm(x.last) === norm(k.last));
    if (r) out.push({ key: `${childIndex}:${g.id}`, childIndex, groupId: g.id, rosterId: r.id });
  }));
  return out;
}

export interface RegistrationInput {
  orgId: string;
  guardianId: string | null;
  guardian: { name: string; email: string; phone: string };
  second: { name: string; email: string } | null;
  kids: DraftChild[];
  linkSiblings: boolean;
  picked: GroupMatch[];
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Save a registration: issue each child a permanent unique number, attach them
 * to their chosen group (claiming a matching roster entry if the organisation
 * already listed them), link the extra groups the parent approved, and
 * optionally link siblings under one family id.
 */
export function commitRegistration(db: KidsDb, input: RegistrationInput): { db: KidsDb; guardianId: string } {
  const guardianId = input.guardianId ?? nextId("p");
  const used = new Set(db.children.map((c) => c.uid));
  const existing = guardianKidsAt(db, input.guardianId, input.orgId);
  const existingIds = new Set(existing.map((c) => c.id));
  const link = input.linkSiblings && existing.length + input.kids.length > 1;
  const famId = link ? (existing.find((c) => c.famId)?.famId ?? nextId("f")) : null;
  const groups = db.groups.map((g) => ({ ...g, roster: [...g.roster] }));

  const newKids: KidsChild[] = input.kids.map((k, childIndex) => {
    let uid: string;
    do { uid = "IK-" + (100000 + Math.floor(Math.random() * 900000)); } while (used.has(uid));
    used.add(uid);
    const id = nextId("c");
    const home = groups.find((g) => g.id === k.groupId);
    if (home) {
      const ri = home.roster.findIndex((x) => !x.childId && norm(x.first) === norm(k.first) && norm(x.last) === norm(k.last));
      if (ri >= 0) home.roster[ri] = { ...home.roster[ri], childId: id };
      else home.roster.push({ id: nextId("r"), first: k.first.trim(), last: k.last.trim(), childId: id });
    }
    const extra = input.picked.filter((m) => m.childIndex === childIndex);
    extra.forEach((m) => {
      const g = groups.find((x) => x.id === m.groupId);
      const i = g ? g.roster.findIndex((x) => x.id === m.rosterId) : -1;
      if (g && i >= 0) g.roster[i] = { ...g.roster[i], childId: id };
    });
    return {
      id, uid, first: k.first.trim(), last: k.last.trim(), year: k.year.trim(), guardianId,
      consent: famId ? { ...k.consent } : { ...k.consent, sibling: false },
      famId, groupIds: [k.groupId, ...extra.map((m) => m.groupId)],
    };
  });

  const guardians = input.guardianId
    ? db.guardians
    : [...db.guardians, { id: guardianId, name: input.guardian.name.trim(), email: input.guardian.email.trim(), phone: input.guardian.phone.trim(), g2: input.second }];

  return {
    guardianId,
    db: {
      ...db, groups, guardians,
      children: [...db.children.map((c) => (famId && existingIds.has(c.id) ? { ...c, famId } : c)), ...newKids],
    },
  };
}

// ── Luma (Kids) ───────────────────────────────────────────────────────────
export const KIDS_LUMA_OPENER = "Hi, I'm Luma. Ask me anything about Illuminate Kids photo days, registration or consent.";

/** Policy the Kids assistant is bound by. Sent as the system prompt to the Luma endpoint. */
export const KIDS_LUMA_SYSTEM = `You are Luma, the AI assistant on the Illuminate Kids website — the children's photography branch of Illuminate Studios (Melbourne). Reply warmly and naturally in 1-4 short sentences, answering the user's actual question. If asked whether you are a bot or AI, say yes plainly: you're Luma, Illuminate's AI assistant, and a team member follows up on anything you can't handle.
Facts you may use: Illuminate Kids photographs early childhood centres, kinders, primary and secondary schools, sports clubs and dance/performing-arts groups. Consent comes first: every consent option starts switched off, and a child who isn't registered or whose consent is declined is excluded from all photos. Consent options per child: individual portrait, class/group photo, sibling photo, yearbook/organisation publications, Illuminate marketing. How it works: the organisation sends an enquiry (a tentative request the studio reviews — nothing is booked or held until the studio confirms); once confirmed the organisation gets a linking code; parents enter the code, register each child and choose consent; after photo day families get a private gallery. Honest benefits for partner organisations: Illuminate handles registration, consent collection and family orders end to end (no admin for staff), staff never handle money or photos, a child-safety and image-handling policy governs every shoot, and the organisation receives a service agreement and run sheet.
Hard rules: never quote or estimate prices, packages, discounts, commissions or fundraising returns — the studio confirms scope, pricing and any partnership details after reviewing an enquiry. Never promise dates, availability holds or reply times. Never invent statistics or claims beyond the facts above. For complaints, child-safety specifics or anything needing a human, direct them to the enquiry form so a team member can follow up.`;

/** Offline fallback — used only when the Luma endpoint is not configured or unreachable. */
export function kidsLumaFallback(text: string): string {
  const q = text.toLowerCase();
  if (/code|register|registration|parent/.test(q)) return 'Your organisation sends a code when registrations open. Tap "I have a code", enter it, then register each child and choose what you consent to.';
  if (/consent|privacy|safe|opt|delete|share/.test(q)) return "Every consent option starts off. A child who isn't registered, or whose consent is declined, is excluded from all photos.";
  if (/price|cost|how much|fee|package|include/.test(q)) return "Scope and inclusions depend on your organisation and numbers. Send an enquiry and the studio will confirm the details with you after reviewing it.";
  if (/book|date|day|school|centre|club|kinder|team|dance/.test(q)) return "Happy to help plan a photo day. Use the enquiry form to tell us your organisation, roughly how many children, and the dates that suit. It is a tentative request: nothing is booked or held until the studio confirms.";
  return "I can help with booking a photo day, parent registration and consent. What would you like to know?";
}

export interface LumaTurn { from: "me" | "luma"; text: string; }

/**
 * Ask Luma. Routes through the studio's policy-guarded endpoint when
 * EXPO_PUBLIC_LUMA_ENDPOINT is set (POST { system, messages } → { text });
 * otherwise, or on any failure, answers from the offline fallback. The app
 * never holds a model API key.
 */
export async function askKidsLuma(history: LumaTurn[], latest: string): Promise<string> {
  const endpoint = process.env.EXPO_PUBLIC_LUMA_ENDPOINT;
  if (endpoint) {
    try {
      const messages = history.slice(-12).map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text }));
      while (messages.length && messages[0].role === "assistant") messages.shift();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "kids", system: KIDS_LUMA_SYSTEM, messages }),
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        if (data.text && data.text.trim()) return data.text.trim();
      }
    } catch {
      // fall through to the offline reply
    }
  }
  return kidsLumaFallback(latest);
}

// ── Formatting ────────────────────────────────────────────────────────────
export const aud = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
export const dateLong = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
export const todayIso = () => new Date().toISOString().slice(0, 10);
