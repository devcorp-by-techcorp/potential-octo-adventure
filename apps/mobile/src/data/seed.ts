/**
 * Seed data — mirrors apps/web/src/data/data.jsx (the subset the mobile
 * feature screens consume). In production this comes from the backend.
 */

export const CLIENT = {
  name: "Eleanor & James Whitfield",
  short: "E&J",
  email: "eleanor.whitfield@hey.com",
  eventDate: "2026-06-14",
  eventType: "Wedding",
  venue: "Stones of the Yarra Valley · VIC",
  package: "Signature",
  phaseIdx: 6,
};

export const PHASES = [
  { label: "Inquiry Received", description: "We've received your enquiry and are reviewing dates." },
  { label: "Agreement Sent", description: "Your photography agreement awaits signature." },
  { label: "Deposit Pending", description: "A 30% retainer secures your date." },
  { label: "Date Confirmed", description: "You're booked. Pre-shoot consultation scheduled." },
  { label: "Shoot Day", description: "The day of. We can't wait." },
  { label: "Curating Your Gallery", description: "Carefully selecting your images. Allow 4–6 weeks." },
  { label: "Gallery Delivered", description: "Your private gallery is live. Select your favourites." },
  { label: "Archived", description: "Your collection is archived in perpetuity." },
];

const proof = (id: string, pid: string, label: string, ratio: number) => ({ id, pid, label, ratio });
export const PROOFS = [
  proof("p01", "1519741497674-611481863552", "Ceremony · 4:12pm", 4 / 5),
  proof("p02", "1606216794074-735e91aa2c92", "First look", 1),
  proof("p03", "1511285560929-80b456fea0bc", "Bridal portrait", 4 / 5),
  proof("p04", "1583939003579-730e3918a45a", "Rings detail", 3 / 2),
  proof("p05", "1465495976277-4387d4b0b4c6", "Aisle", 4 / 5),
  proof("p06", "1519225421980-715cb0215aed", "Vows", 3 / 2),
  proof("p07", "1525772764200-be829a350797", "Reception", 4 / 5),
  proof("p09", "1523438885200-e635ba2c371e", "Bouquet", 4 / 5),
  proof("p10", "1591604466107-ec97de577aff", "Groom prep", 3 / 4),
  proof("p11", "1519671482749-fd09be7ccebf", "Bridesmaids", 4 / 5),
  proof("p13", "1511795409834-ef04bbd61622", "Cake cut", 4 / 3),
  proof("p15", "1583939411023-14783179e581", "Golden hour", 3 / 2),
];
export const proofUri = (pid: string, w = 900) =>
  "https://images.unsplash.com/photo-" + pid + "?w=" + w + "&q=80&auto=format&fit=crop";

export interface Booking {
  id: string; clientName: string; eventType: string; date: string; time: string;
  venue: string; phase: number; status: "confirmed" | "pending"; value: number;
  pkg: string; bookedBy: string; notes: string;
}
export const BOOKINGS: Booking[] = [
  { id: "b1", clientName: "Whitfield · Eleanor & James", eventType: "Wedding", date: "2026-06-14", time: "11:00 AM – 9:00 PM", venue: "Stones of the Yarra Valley", phase: 6, status: "confirmed", value: 5800, pkg: "Signature", bookedBy: "Victoria Caine · Studio Director", notes: "Heavy candid coverage through the reception. Prioritise the grandmother in family formals. No flash during the ceremony." },
  { id: "b2", clientName: "Marchetti · Sofia & Luca", eventType: "Wedding", date: "2026-07-22", time: "10:00 AM – 8:00 PM", venue: "Werribee Park Mansion", phase: 3, status: "confirmed", value: 9200, pkg: "Atelier", bookedBy: "Luma · AI Concierge", notes: "Bilingual celebrant. Second shooter confirmed. Drone permit approved." },
  { id: "b3", clientName: "Okonkwo · Adaeze", eventType: "Portrait", date: "2026-05-30", time: "2:00 PM – 4:00 PM", venue: "Studio · Collingwood", phase: 4, status: "confirmed", value: 3200, pkg: "Essentials", bookedBy: "Victoria Caine · Studio Director", notes: "Personal-branding headshots. Three outfit changes. Neutral backdrop." },
  { id: "b4", clientName: "Chen · Mira", eventType: "Editorial", date: "2026-06-08", time: "9:00 AM – 1:00 PM", venue: "Royal Botanic Gardens · Cranbourne", phase: 1, status: "pending", value: 5800, pkg: "Signature", bookedBy: "Luma · AI Concierge", notes: "Editorial commission for a press feature. Art director on the day. Natural light only." },
  { id: "b5", clientName: "Aldridge · Theo & Marcus", eventType: "Wedding", date: "2026-08-15", time: "12:00 PM – 10:00 PM", venue: "Mt Macedon Estate", phase: 2, status: "confirmed", value: 5800, pkg: "Signature", bookedBy: "Luma · AI Concierge", notes: "Intimate wedding, 30 guests. Keep direction minimal and relaxed." },
  { id: "b6", clientName: "Holloway · Beatrice", eventType: "Family", date: "2026-05-24", time: "4:30 PM – 6:00 PM", venue: "Carlton Gardens", phase: 5, status: "confirmed", value: 3200, pkg: "Essentials", bookedBy: "Victoria Caine · Studio Director", notes: "Extended family of 12, two toddlers. Short and playful. Dog joins for final frames." },
];

export const INQUIRIES = [
  { name: "Astrid Lindqvist", type: "Wedding", message: "Considering Signature or Atelier for a 150-guest wedding at Mona Farm. Could we arrange a call?" },
  { name: "Nile Bashir", type: "Editorial", message: "Looking for a fine-art editorial session for a magazine feature." },
  { name: "Priya Rajaram", type: "Wedding", message: "Three-day wedding at Stamford Plaza. Interested in Atelier with travel." },
];

export const KPIS = [
  { label: "Upcoming shoots", value: "6", delta: "2 this week", tone: "muted" as const },
  { label: "New inquiries", value: "3", delta: "+2 today", tone: "success" as const },
  { label: "Awaiting deposit", value: "2", delta: "AUD 4,560 held", tone: "warning" as const },
  { label: "Revenue · May", value: "24.6k", delta: "AUD · +18%", tone: "success" as const },
];

// ── Client portal: correspondence, filed documents, print collection ──
export interface InboxItem {
  id: string; title: string; from: string; sentAt: string;
  requiresSignature: boolean; pages: number; read: boolean; preview: string;
}
export const INBOX_INITIAL: InboxItem[] = [
  {
    id: "i1", title: "Optional Portfolio & Marketing Release", from: "Studio Director",
    sentAt: "2026-05-02", requiresSignature: true, pages: 3, read: false,
    preview: "Optional consent allowing Illuminate Studios to feature select images from your collection in portfolio and editorial submissions.",
  },
  {
    id: "i2", title: "Pre-Shoot Questionnaire", from: "Studio Director",
    sentAt: "2026-04-28", requiresSignature: false, pages: 2, read: true,
    preview: "A brief questionnaire covering family groupings, must-have shots, and venue logistics.",
  },
];

export interface ClientDoc { id: string; title: string; type: string; signedAt: string; size: string; pages: number; }
export const CLIENT_DOCS_INITIAL: ClientDoc[] = [
  { id: "d1", title: "Wedding Photography Agreement", type: "Contract", signedAt: "2026-02-14", size: "382 KB", pages: 8 },
  { id: "d2", title: "Package Schedule & Add-Ons", type: "Schedule", signedAt: "2026-02-14", size: "127 KB", pages: 4 },
];

export const PRINT_SIZES = [
  { label: "Petite", dims: "20×30 cm", from: 145, desc: "Single frame · mat & glass" },
  { label: "Standard", dims: "30×45 cm", from: 285, desc: "Studio classic", highlight: true },
  { label: "Grand", dims: "45×60 cm", from: 510, desc: "Statement piece" },
  { label: "Heirloom", dims: "60×90 cm", from: 840, desc: "Archival giclée on cotton rag" },
];

// The wall is a composed selection, not the whole gallery.
export const WALL_IDS = ["p01", "p02", "p04", "p03", "p07", "p06", "p09", "p13", "p15", "p11"];

// ── Public marketing surface (mirrors the web Marketing & pricing module) ──
// Copy is bound by the Image Representation & Content Policy: never imply
// client images are edited / retouched / enhanced — "selected" only.
export const MARKETING = {
  place: "Melbourne · Australia-wide",
  headline: "Editorial photography for the days that matter.",
  lede:
    "A boutique studio for weddings, portraits and brand work — one photographer, a considered eye, and a private gallery of selected frames.",
  printNote:
    "Archival cotton-rag prints, hand-mounted and studio-signed. Available with every collection.",
};

export const PROCESS = [
  { step: "01", title: "Enquire", body: "Luma, our concierge, answers first and passes your dates to Victoria.", icon: "sparkle" as const },
  { step: "02", title: "Book", body: "A 30% retainer secures the date. Agreement and schedule are signed in-portal.", icon: "doc" as const },
  { step: "03", title: "Prepare", body: "A short intake questionnaire becomes your photographer's brief for the day.", icon: "clipboard" as const },
  { step: "04", title: "Receive", body: "Your private gallery of selected frames, ready for album and print choices.", icon: "gallery" as const },
];

export interface Package {
  name: string; price: number; forWhom: string; featured?: boolean; includes: string[];
}
export const PACKAGES: Package[] = [
  {
    name: "Essentials", price: 3200, forWhom: "Portrait · family · headshots",
    includes: ["Two-hour session", "Lead photographer", "120+ selected images", "Six-month private gallery"],
  },
  {
    name: "Signature", price: 5800, forWhom: "Weddings · editorial commissions", featured: true,
    includes: ["Lead + second photographer", "600+ selected images", "Twelve-month private gallery", "90-minute engagement session"],
  },
  {
    name: "Atelier", price: 9200, forWhom: "Multi-day weddings · brand campaigns",
    includes: ["Full-day coverage, two photographers", "900+ selected images", "Fine-art print collection", "Album design · travel within Victoria"],
  },
];

export const INTAKE_STEPS = [
  { title: "Your details", fields: [ { key: "names", label: "Names", type: "text", ph: "Both partners" }, { key: "email", label: "Best email", type: "text", ph: "you@email.com" } ] },
  { title: "The day", fields: [ { key: "date", label: "Wedding date", type: "text", ph: "Date" }, { key: "venue", label: "Venue", type: "text", ph: "Where" }, { key: "guests", label: "Approx. guest count", type: "text", ph: "e.g. 120" } ] },
  { title: "Moments that matter", fields: [ { key: "moments", label: "Select the moments you want prioritised", type: "chips", options: ["Getting ready", "First look", "Ceremony", "Family formals", "Reception", "Send-off"] } ] },
  { title: "Anything else", fields: [ { key: "notes", label: "Must-have shots or notes for the photographer", type: "area", ph: "Tell us what matters most…" } ] },
] as const;

// ── Helpers ──
const TODAY = new Date("2026-05-14");
export const daysUntil = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - TODAY.getTime()) / 86400000));
export const money = (n: number) => "AUD " + n.toLocaleString("en-AU");
export const money$ = (n: number) => "$" + n.toLocaleString("en-AU");
export const dayOf = (iso: string) => new Date(iso).getDate();
export const monShort = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
export const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
export const dateShort = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
export const docMeta = (d: ClientDoc) => `${d.pages}pp · ${d.size} · signed ${dateLabel(d.signedAt)}`;

// Luma canned reply (policy-safe: never "edited/retouched", never over-promises).
// Persona openers — Luma greets by auth state (public visitor vs client vs studio).
export const LUMA_OPENERS = {
  public:
    "Welcome to Illuminate Studios. I can talk you through collections and hold a tentative date — Victoria confirms every booking herself. What are you planning?",
  client:
    "Welcome back, Eleanor. Your private gallery is ready — 248 frames from the Whitfield collection. How can I help today?",
  admin:
    "Good morning, Victoria. Three new inquiries overnight and two deposits outstanding. What would you like to look at?",
};

export type Persona = "public" | "client" | "admin";

// Customer-facing Luma (public + client) is chat-only — no prompt buttons.
// Only the studio-staff persona keeps shortcut prompts.
export const LUMA_QUICKS: Record<Persona, string[]> = {
  public: [],
  client: [],
  admin: ["Today's shoots", "Outstanding deposits", "New inquiries"],
};

export function lumaReply(text: string, persona: Persona = "client"): string {
  const low = text.toLowerCase();
  if (/book|avail|date|hold|free/.test(low)) return "I can hold a tentative date for you — nothing is confirmed until Victoria reviews it. What date are you considering?";
  if (/price|cost|package|signature|atelier|essential|include/.test(low)) return "Signature is AUD 5,800 — lead + second photographer, 600+ selected images, a 12-month private gallery, and a 90-minute engagement session. Shall I note your interest?";
  if (/work|process|how/.test(low)) return "Four steps: you enquire, a 30% retainer secures the date, a short intake questionnaire briefs your photographer, then your private gallery of selected frames arrives.";
  // Gallery specifics are client-only — never disclosed to a public visitor.
  if (/gallery|photo|frame|select|album/.test(low)) {
    return persona === "public"
      ? "Galleries are private to each client — once you're booked, yours appears in the portal with your selected frames. Would you like me to note your interest?"
      : "Your selected gallery is ready — 248 frames from the Whitfield collection. Open the Gallery tab to add favourites to your album selections.";
  }
  if (/hi|hello|hey|thanks|thank/.test(low)) {
    return persona === "public"
      ? "Lovely to hear from you. Tell me the date and the kind of shoot, and I'll see what's open."
      : "Always a pleasure, Eleanor. Anything you need for the big day, I'm right here.";
  }
  return persona === "public"
    ? "I can talk you through collections, availability and how a booking runs. What would you like to know?"
    : "I'm here to help with your gallery, documents, and booking. What would you like to do?";
}


// ── Studio admin records (mirrors the web admin + finance modules) ──
export interface Contact { id: string; name: string; email: string; phone: string; bookingId: string; assigned: boolean; tags: string[]; }
export const CONTACTS: Contact[] = [
  { id: "c1", name: "Eleanor & James Whitfield", email: "eleanor.whitfield@hey.com", phone: "+61 412 558 921", bookingId: "b1", assigned: true, tags: ["VIP", "Returning"] },
  { id: "c2", name: "Sofia & Luca Marchetti", email: "sofia@marchetti.it", phone: "+61 423 887 104", bookingId: "b2", assigned: true, tags: ["Destination"] },
  { id: "c3", name: "Adaeze Okonkwo", email: "ada@studio-ko.com", phone: "+61 401 442 218", bookingId: "b3", assigned: true, tags: [] },
  { id: "c4", name: "Mira Chen", email: "mira@chenmira.studio", phone: "+61 432 119 448", bookingId: "b4", assigned: false, tags: ["Press"] },
  { id: "c5", name: "Theo & Marcus Aldridge", email: "t.aldridge@me.com", phone: "+61 408 776 512", bookingId: "b5", assigned: true, tags: [] },
  { id: "c6", name: "Beatrice Holloway", email: "bea.holloway@gmail.com", phone: "+61 421 904 677", bookingId: "b6", assigned: true, tags: ["Family"] },
];

export interface Inquiry { id: string; name: string; email: string; date: string; type: string; receivedAt: string; status: string; message: string; }
export const INQUIRIES_FULL: Inquiry[] = [
  { id: "q1", name: "Astrid Lindqvist", email: "astrid@northstudio.co", date: "2026-09-12", type: "Wedding", receivedAt: "2026-05-13", status: "new", message: "Considering Signature or Atelier for a 150-guest wedding at Mona Farm. Could we arrange a call?" },
  { id: "q2", name: "Nile Bashir", email: "nile.b@gmail.com", date: "2026-07-05", type: "Editorial", receivedAt: "2026-05-12", status: "new", message: "Looking for a fine-art editorial session for a magazine feature." },
  { id: "q3", name: "Priya Rajaram", email: "priya.r@outlook.com", date: "2026-10-04", type: "Wedding", receivedAt: "2026-05-10", status: "reviewing", message: "Three-day wedding at Stamford Plaza. Interested in Atelier with travel." },
];

export const ACTIVITY = [
  { time: "2h", text: "Eleanor Whitfield viewed her gallery" },
  { time: "6h", text: "Sofia Marchetti signed Wedding Agreement" },
  { time: "1d", text: "New inquiry from Astrid Lindqvist (Sep 12)", gold: true },
  { time: "2d", text: "Adaeze Okonkwo paid Essentials retainer (960)" },
  { time: "3d", text: "Beatrice Holloway · gallery delivered (218 images)" },
  { time: "5d", text: "Theo & Marcus Aldridge moved to Confirmed" },
];

/** The studio's reusable template library — [num, name, type, group]. */
export const TEMPLATES: [string, string, string, string][] = [
  ["01", "Booking Request Received", "Booking", "Booking & Onboarding"],
  ["02", "Booking Confirmation", "Booking", "Booking & Onboarding"],
  ["03", "Booking Change Request", "Booking", "Booking & Onboarding"],
  ["04", "Session Reminder", "Reminder", "Booking & Onboarding"],
  ["05", "Photography Services Agreement", "Contract", "Agreements & Consents"],
  ["06", "Privacy Notice & Promotion Consent", "Consent", "Agreements & Consents"],
  ["07", "Payment Invoice", "Invoice", "Payments"],
  ["08", "Payment Receipt", "Receipt", "Payments"],
  ["09", "Payment Reminder", "Reminder", "Payments"],
  ["10", "Portrait Session Guide", "Guide", "Session Documents"],
  ["11", "Wedding Photography Run Sheet", "Run Sheet", "Session Documents"],
  ["12", "Wedding Client Timeline Confirmation", "Schedule", "Session Documents"],
  ["13", "Boudoir Private Session Confirmation", "Booking", "Session Documents"],
  ["14", "Boudoir Restricted Photographer Brief", "Brief", "Internal"],
  ["15", "Newborn Session Guide", "Guide", "Session Documents"],
  ["16", "Newborn Internal Safety Brief", "Brief", "Internal"],
  ["17", "Birth Call-Out Plan", "Run Sheet", "Session Documents"],
  ["18", "Birth Private Preferences Brief", "Brief", "Internal"],
  ["19", "Brand / Corporate Proposal", "Proposal", "Session Documents"],
  ["20", "Brand / Corporate Call Sheet", "Run Sheet", "Session Documents"],
  ["21", "Gallery Release", "Release", "Gallery & Aftercare"],
  ["22", "Gallery Expiry Reminder", "Reminder", "Gallery & Aftercare"],
  ["23", "Gallery Archive Notice", "Gallery", "Gallery & Aftercare"],
  ["24", "Internal Booking Handover", "Internal", "Internal"],
  ["25", "Internal Post-Session Checklist", "Checklist", "Internal"],
  ["26", "Internal Incident & Escalation Note", "Internal", "Internal"],
];

export interface StudioDoc { id: string; contactId: string; title: string; type: string; status: string; createdAt: string; }
export const STUDIO_DOCS: StudioDoc[] = [
  { id: "cd1", contactId: "c1", title: "Wedding Photography Agreement", type: "Contract", status: "signed", createdAt: "2026-02-14" },
  { id: "cd2", contactId: "c1", title: "Package Schedule & Add-Ons", type: "Schedule", status: "signed", createdAt: "2026-02-14" },
  { id: "cd3", contactId: "c2", title: "Atelier Photography Agreement", type: "Contract", status: "awaiting signature", createdAt: "2026-05-06" },
  { id: "cd4", contactId: "c2", title: "Drone Permit · Werribee Park", type: "Schedule", status: "sent", createdAt: "2026-05-08" },
  { id: "cd5", contactId: "c5", title: "Wedding Photography Agreement", type: "Contract", status: "awaiting signature", createdAt: "2026-05-10" },
  { id: "cd6", contactId: "c6", title: "Portrait Session Guide", type: "Guide", status: "sent", createdAt: "2026-05-04" },
];

/** Settled prior-season invoices — [number, issued, client, description, gross, income account]. */
const INV_SEED: [number, string, string, string, number, string][] = [
  [1001, "2025-07-18", "Nguyen Family", "Family portrait session — Carlton Gardens", 1450, "4-110"],
  [1002, "2025-08-02", "Patel · Anika & Dev", "Wedding photography — Signature collection", 5800, "4-100"],
  [1003, "2025-08-23", "Reyes · Camila", "Personal branding portrait session", 3200, "4-110"],
  [1004, "2025-09-12", "O'Connell · Saoirse & Finn", "Wedding photography — Atelier collection", 7800, "4-100"],
  [1005, "2025-10-04", "Tan · Wei & Jasmine", "Engagement session — Brighton bathing boxes", 1650, "4-100"],
  [1006, "2025-10-25", "Kowalski · Lena & Tomas", "Wedding photography — Signature collection", 5800, "4-100"],
  [1007, "2025-11-15", "Abadi Studio", "Editorial commission — lookbook", 4600, "4-120"],
  [1008, "2025-12-06", "Fitzgerald · Grace & Henry", "Wedding photography — Atelier collection", 9200, "4-100"],
  [1009, "2026-01-17", "Marsh · Olivia", "Portrait session — studio", 3200, "4-110"],
  [1010, "2026-02-07", "Silva · Isabela & Rafael", "Wedding photography — Signature collection", 5800, "4-100"],
  [1011, "2026-02-28", "Hart Family", "Family session — golden hour", 1450, "4-110"],
  [1012, "2026-03-14", "Beaumont & Co", "Editorial commission — press feature", 4600, "4-120"],
  [1013, "2026-04-11", "Ibrahim · Layla", "Portrait session — studio", 3200, "4-110"],
  [1014, "2026-04-25", "Lowe · Prudence", "Fine-art album & print order", 1120, "4-130"],
];

/** Event type → income account in the chart of accounts. */
export const EVENT_ACCOUNT: Record<string, string> = {
  Wedding: "4-100", Engagement: "4-100", Portrait: "4-110", Family: "4-110",
  Editorial: "4-120", Commercial: "4-120",
};

export const STUDIO_TODAY = "2026-05-14";
export const addDays = (iso: string, n: number) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const minIso = (a: string, b: string) => (a < b ? a : b);

export interface Invoice {
  id: string; number: string; client: string; desc: string; issue: string; due: string;
  gross: number; paid: string | null; status: "paid" | "due" | "overdue";
  /** Income account this invoice is posted to (chart of accounts code). */
  account: string;
  /** Where the record came from — a settled prior-season seed, or derived from a booking's phase. */
  source: "seed" | "derived";
}

/**
 * Seeded prior-season invoices plus retainers and balances derived from booking
 * phase — the same ladder the web finance module uses (retainer raised at phase
 * ≥ 2 and paid from ≥ 3; final balance raised at ≥ 4 and paid from ≥ 6).
 */
export function buildInvoices(bookings: Booking[]): Invoice[] {
  const T = STUDIO_TODAY;
  const rows: Omit<Invoice, "status">[] = INV_SEED.map(([n, date, client, desc, gross, account]) => ({
    id: "inv-" + n, number: "INV-" + n, client, desc, issue: date, due: addDays(date, 14), gross, paid: addDays(date, 7),
    account, source: "seed" as const,
  }));
  bookings.forEach((b) => {
    const ref = "IS-26-" + String(parseInt(String(b.id).replace(/\D/g, ""), 10) || 0).padStart(3, "0");
    const name = b.clientName.indexOf("·") >= 0 ? b.clientName.split("·").slice(1).join("·").trim() : b.clientName;
    const dep = Math.round(b.value * 0.3);
    if (b.phase >= 2) {
      const iss = minIso(addDays(b.date, -75), addDays(T, -7));
      rows.push({ id: "inv-" + b.id + "-r", number: "INV-" + ref + "-R", client: name, desc: "Booking retainer (30%) — " + b.eventType, issue: iss, due: addDays(iss, 14), gross: dep, paid: b.phase >= 3 ? minIso(addDays(iss, 7), T) : null, account: EVENT_ACCOUNT[b.eventType] ?? "4-110", source: "derived" });
    }
    if (b.phase >= 4) {
      const iss = minIso(addDays(b.date, -14), addDays(T, -3));
      rows.push({ id: "inv-" + b.id + "-f", number: "INV-" + ref + "-F", client: name, desc: "Final balance — " + b.eventType, issue: iss, due: addDays(iss, 14), gross: b.value - dep, paid: b.phase >= 6 ? minIso(addDays(iss, 7), addDays(T, -1)) : null, account: EVENT_ACCOUNT[b.eventType] ?? "4-110", source: "derived" });
    }
  });
  return rows
    .map((r) => ({ ...r, status: (r.paid ? "paid" : r.due < T ? "overdue" : "due") as Invoice["status"] }))
    .sort((a, b) => b.issue.localeCompare(a.issue));
}

export const money0 = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
export const initials = (name: string) =>
  name.split(" ").filter((w) => /[a-z]/i.test(w[0] ?? "")).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
