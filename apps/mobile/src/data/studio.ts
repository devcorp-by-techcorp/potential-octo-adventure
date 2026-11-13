/**
 * Studio identity, employment records and the supplier register.
 *
 * Identity is the studio's single source of truth for who it is: Luma, the nav
 * rail, documents, reports and correspondence all read the same three records.
 * The roster carries the employment terms — position, pay, superannuation and
 * contract — for the same people plus everyone else the studio engages.
 */

export const TODAY = "2026-05-14";

export type IdentityKey = "manager" | "photographer" | "business";

export interface Identity {
  key: IdentityKey;
  slot: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  /** Required identities block save when blank — Luma needs a name to address. */
  required: boolean;
  hint: string;
}

export const IDENTITY_SEED: Record<IdentityKey, Identity> = {
  manager: {
    key: "manager", slot: "Studio Manager", name: "Victoria Caine", title: "Studio Manager",
    email: "victoria@illuminatestudios.com.au", phone: "+61 3 9417 2280", required: true,
    hint: "Luma greets whoever signs in to the studio portal by this name, and every document, report and email signs off with it.",
  },
  photographer: {
    key: "photographer", slot: "Principal / Lead Photographer", name: "Rosalind Vance", title: "Principal Photographer",
    email: "rosalind@illuminatestudios.com.au", phone: "+61 3 9417 2281", required: true,
    hint: "Named on shoot schedules, booking confirmations and the public site.",
  },
  business: {
    key: "business", slot: "Business Manager", name: "Desmond Achebe", title: "Business Manager",
    email: "accounts@illuminatestudios.com.au", phone: "+61 3 9417 2282", required: false,
    hint: "Named on invoices, BAS lodgment and supplier correspondence.",
  },
};

export type EngagementType = "Employee · Full-time" | "Employee · Part-time" | "Casual" | "Contractor";
export type PayBasis = "Salary" | "Hourly" | "Day rate";
export type ContractStatus = "Signed" | "Awaiting signature" | "Draft" | "Expiring" | "Ended";

export interface StaffContract {
  type: string;
  ref: string;
  status: ContractStatus;
  signed: string;
  /** "Ongoing" or an ISO date. */
  expires: string;
}

export interface StaffMember {
  id: string;
  identityKey: IdentityKey | null;
  active: boolean;
  name: string;
  position: string;
  type: EngagementType;
  start: string;
  end?: string | null;
  payBasis: PayBasis;
  rate: number;
  hours: number;
  superPct: number;
  award: string;
  email: string;
  phone: string;
  abn: string;
  contract: StaffContract;
  notes: string;
}

export const ROSTER_SEED: StaffMember[] = [
  {
    id: "st1", identityKey: "manager", active: true, name: "Victoria Caine", position: "Studio Manager",
    type: "Employee · Full-time", start: "2023-03-06", payBasis: "Salary", rate: 92000, hours: 38, superPct: 12,
    award: "Professional Employees Award · Level 4", email: "victoria@illuminatestudios.com.au", phone: "+61 3 9417 2280", abn: "",
    contract: { type: "Employment Agreement", ref: "EMP-001", status: "Signed", signed: "2023-03-06", expires: "Ongoing" },
    notes: "Approves bookings, document releases and refunds. Named on internal handover documents.",
  },
  {
    id: "st2", identityKey: "photographer", active: true, name: "Rosalind Vance", position: "Principal / Lead Photographer",
    type: "Employee · Full-time", start: "2022-08-15", payBasis: "Salary", rate: 105000, hours: 38, superPct: 12,
    award: "Professional Employees Award · Level 5", email: "rosalind@illuminatestudios.com.au", phone: "+61 3 9417 2281", abn: "",
    contract: { type: "Employment Agreement", ref: "EMP-002", status: "Signed", signed: "2022-08-15", expires: "Ongoing" },
    notes: "Confirms shoot dates and assigns second photographers.",
  },
  {
    id: "st3", identityKey: "business", active: true, name: "Desmond Achebe", position: "Business Manager",
    type: "Employee · Part-time", start: "2024-02-05", payBasis: "Hourly", rate: 58, hours: 22.8, superPct: 12,
    award: "Clerks — Private Sector Award · Level 5", email: "accounts@illuminatestudios.com.au", phone: "+61 3 9417 2282", abn: "",
    contract: { type: "Employment Agreement", ref: "EMP-003", status: "Signed", signed: "2024-02-05", expires: "Ongoing" },
    notes: "Three days a week. Sole approver for BAS lodgment and payroll.",
  },
  {
    id: "st4", identityKey: null, active: true, name: "Priya Raman", position: "Second Photographer",
    type: "Casual", start: "2025-01-18", payBasis: "Hourly", rate: 62, hours: 14, superPct: 12,
    award: "Casual loading 25% included in rate", email: "priya.raman@illuminatestudios.com.au", phone: "+61 431 770 219", abn: "",
    contract: { type: "Casual Employment Agreement", ref: "CAS-004", status: "Signed", signed: "2025-01-18", expires: "Ongoing" },
    notes: "Rostered against weddings on the Signature and Atelier collections.",
  },
  {
    id: "st5", identityKey: null, active: true, name: "Noah Whittaker", position: "Studio Assistant · Capture & Culling",
    type: "Casual", start: "2025-09-02", payBasis: "Hourly", rate: 38.5, hours: 10, superPct: 12,
    award: "Casual loading 25% included in rate", email: "noah.whittaker@illuminatestudios.com.au", phone: "+61 402 118 663", abn: "",
    contract: { type: "Casual Employment Agreement", ref: "CAS-005", status: "Awaiting signature", signed: "", expires: "Ongoing" },
    notes: "Loads and backs up cards on shoot days, prepares the first cull for Rosalind.",
  },
  {
    id: "st6", identityKey: null, active: true, name: "Amara Osei", position: "Contract Second Photographer",
    type: "Contractor", start: "2024-11-04", payBasis: "Day rate", rate: 780, hours: 0, superPct: 12,
    award: "Engaged per shoot · invoices the studio", email: "hello@amaraosei.com.au", phone: "+61 466 902 447", abn: "74 619 302 885",
    contract: { type: "Contractor Services Agreement", ref: "CON-006", status: "Expiring", signed: "2024-11-04", expires: "2026-06-30" },
    notes: "Superannuation payable — engaged principally for her labour under s.12(3).",
  },
  {
    id: "st7", identityKey: null, active: false, name: "Elena Brandt", position: "Studio Coordinator",
    type: "Employee · Part-time", start: "2023-05-22", end: "2025-11-14", payBasis: "Hourly", rate: 44, hours: 15, superPct: 11.5,
    award: "Clerks — Private Sector Award · Level 3", email: "elena.brandt@post.com", phone: "+61 419 224 087", abn: "",
    contract: { type: "Employment Agreement", ref: "EMP-004", status: "Ended", signed: "2023-05-22", expires: "2025-11-14" },
    notes: "Final pay and accrued leave settled 21 November 2025. Record retained seven years.",
  },
];

export const ENGAGEMENT_TYPES: EngagementType[] = ["Employee · Full-time", "Employee · Part-time", "Casual", "Contractor"];
export const PAY_BASES: PayBasis[] = ["Salary", "Hourly", "Day rate"];
export const CONTRACT_TYPES = ["Employment Agreement", "Casual Employment Agreement", "Contractor Services Agreement", "Second Photographer Agreement"];
export const CONTRACT_STATUSES: ContractStatus[] = ["Signed", "Awaiting signature", "Draft", "Expiring", "Ended"];

const aud = (v: number, dp: number) => "$" + v.toLocaleString("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function staffPayLabel(p: StaffMember): string {
  if (p.payBasis === "Salary") return aud(p.rate, 0) + " / year";
  if (p.payBasis === "Day rate") return aud(p.rate, 0) + " / day";
  return aud(p.rate, 2) + " / hour";
}

/** Weekly commitment: salary over 52 weeks, hourly at rostered hours. Day-rate
 *  contractors are engaged per shoot, so they carry no standing commitment. */
export function staffWeekly(p: StaffMember): number {
  if (!p.active) return 0;
  if (p.payBasis === "Salary") return p.rate / 52;
  if (p.payBasis === "Hourly") return p.rate * (p.hours || 0);
  return 0;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** True when a contract needs signing, renewing, or expires inside 90 days. */
export function staffContractFlag(p: StaffMember): boolean {
  if (!p.active) return false;
  const c = p.contract;
  if (c.status === "Awaiting signature" || c.status === "Draft" || c.status === "Expiring") return true;
  if (c.expires !== "Ongoing" && c.expires < addDays(TODAY, 90)) return true;
  return false;
}

export type ContractTone = "success" | "warning" | "muted";
export function contractTone(status: ContractStatus): ContractTone {
  if (status === "Signed") return "success";
  if (status === "Ended") return "muted";
  return "warning";
}

export interface SupplierItem { desc: string; cost: number; unit: string }

export interface Supplier {
  id: string;
  active: boolean;
  /** Enquired with but not yet engaged — shown as a potential partner in the directory. */
  prospect?: boolean;
  name: string;
  entity: string;
  abn: string;
  acn: string;
  gst: boolean;
  category: string;
  address: string;
  phone: string;
  email: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  terms: string;
  account: string;
  since: string;
  items: SupplierItem[];
  notes: string;
}

export const SUPPLIER_CATEGORIES = ["Print & framing", "Equipment hire", "Professional services", "Albums & bindery", "Insurance", "Travel & logistics", "Venue & location", "Software & studio"];
export const SUPPLIER_ENTITIES = ["Company (Pty Ltd)", "Sole trader", "Partnership", "Trust"];

export const SUPPLIERS_SEED: Supplier[] = [
  {
    id: "sp1", active: true, name: "Hunter & Vale Print Atelier", entity: "Company (Pty Ltd)",
    abn: "61 452 907 118", acn: "452 907 118", gst: true, category: "Print & framing",
    address: "14 Sackville Street, Collingwood VIC 3066", phone: "+61 3 9417 5540", email: "orders@hunterandvale.com.au",
    contactName: "Marguerite Hollis", contactRole: "Studio Account Manager", contactPhone: "+61 412 884 302", contactEmail: "marguerite@hunterandvale.com.au",
    terms: "Net 14 days", account: "ILLUM-0042", since: "2022-09-01",
    items: [
      { desc: "Fine-art giclée print · A2 cotton rag", cost: 145, unit: "per print" },
      { desc: "Hand-finished oak frame · to A2", cost: 260, unit: "per frame" },
      { desc: "Museum mounting & backing", cost: 48, unit: "per print" },
    ],
    notes: "Sole print partner for the fine-art collection. Turnaround 6 working days.",
  },
  {
    id: "sp2", active: true, name: "Southbank Lighting & Grip Hire", entity: "Company (Pty Ltd)",
    abn: "88 137 604 552", acn: "137 604 552", gst: true, category: "Equipment hire",
    address: "3/86 Boundary Street, South Melbourne VIC 3205", phone: "+61 3 9690 4411", email: "hire@southbankgrip.com.au",
    contactName: "Dev Sandhu", contactRole: "Hire Desk Supervisor", contactPhone: "+61 438 511 020", contactEmail: "dev@southbankgrip.com.au",
    terms: "Net 7 days", account: "SBG-1188", since: "2023-04-19",
    items: [
      { desc: "Continuous lighting kit · 2-head", cost: 340, unit: "per day" },
      { desc: "Portable power station", cost: 180, unit: "per day" },
      { desc: "Weekend collection surcharge", cost: 65, unit: "per hire" },
    ],
    notes: "Booked per shoot. Damage waiver included in the day rate.",
  },
  {
    id: "sp3", active: true, name: "Ledger & Vine Advisory", entity: "Partnership",
    abn: "27 908 445 663", acn: "", gst: true, category: "Professional services",
    address: "Level 2, 340 Smith Street, Fitzroy VIC 3065", phone: "+61 3 9486 7720", email: "studio@ledgerandvine.com.au",
    contactName: "Harriet Nkemelu", contactRole: "Principal · Registered Tax Agent", contactPhone: "+61 407 336 918", contactEmail: "harriet@ledgerandvine.com.au",
    terms: "Net 30 days", account: "LV-ILLU", since: "2022-07-01",
    items: [
      { desc: "BAS preparation & lodgment", cost: 420, unit: "per quarter" },
      { desc: "Payroll & STP filing", cost: 180, unit: "per month" },
      { desc: "Annual financial statements & tax return", cost: 1850, unit: "per year" },
    ],
    notes: "Registered tax agent 25 918 004. Lodges the studio BAS through the agent portal.",
  },
  {
    id: "sp4", active: true, name: "Meridian Album Bindery", entity: "Sole trader",
    abn: "55 210 774 309", acn: "", gst: true, category: "Albums & bindery",
    address: "9 Peel Street, Windsor VIC 3181", phone: "+61 3 9510 8834", email: "bindery@meridianalbums.com.au",
    contactName: "Tomas Berec", contactRole: "Bindery Owner", contactPhone: "+61 421 660 745", contactEmail: "tomas@meridianalbums.com.au",
    terms: "50% deposit · balance on delivery", account: "MER-207", since: "2023-02-11",
    items: [
      { desc: "Linen-bound album · 40 spreads", cost: 610, unit: "per album" },
      { desc: "Clamshell presentation box", cost: 145, unit: "per box" },
      { desc: "Parent duplicate album", cost: 395, unit: "per album" },
    ],
    notes: "Six-week lead time in wedding season. Quotes honoured for 90 days.",
  },
  {
    id: "sp5", active: true, name: "CoverPoint Insurance Brokers", entity: "Company (Pty Ltd)",
    abn: "19 604 118 250", acn: "604 118 250", gst: true, category: "Insurance",
    address: "Suite 8, 121 Flinders Lane, Melbourne VIC 3000", phone: "+61 3 9600 2244", email: "claims@coverpoint.com.au",
    contactName: "Fiona Delacroix", contactRole: "Account Broker · AR 001284", contactPhone: "+61 400 771 552", contactEmail: "fiona@coverpoint.com.au",
    terms: "Annual · direct debit", account: "CP-77401", since: "2022-07-01",
    items: [
      { desc: "Public liability · $20m", cost: 1180, unit: "per year" },
      { desc: "Equipment & transit cover", cost: 1300, unit: "per year" },
      { desc: "Professional indemnity", cost: 640, unit: "per year" },
    ],
    notes: "Policy renews 1 July. Certificates of currency are filed in Documents.",
  },
  {
    id: "sp6", active: false, name: "Yarra Valley Transit", entity: "Sole trader",
    abn: "42 336 019 771", acn: "", gst: false, category: "Travel & logistics",
    address: "22 Melba Highway, Yarra Glen VIC 3775", phone: "+61 3 9730 1180", email: "bookings@yvtransit.com.au",
    contactName: "Gerald Pryce", contactRole: "Owner / Driver", contactPhone: "+61 417 002 366", contactEmail: "gerald@yvtransit.com.au",
    terms: "Payment on the day", account: "—", since: "2024-03-08",
    items: [
      { desc: "Vehicle & driver · regional shoots", cost: 210, unit: "per day" },
      { desc: "Equipment transfer · metro", cost: 95, unit: "per trip" },
    ],
    notes: "Not registered for GST — no GST credit claimable. On hold pending a second quote.",
  },
];

export const digitsOnly = (v: string) => (v || "").replace(/\D/g, "");
export function formatAbn(v: string): string {
  const d = digitsOnly(v);
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : (v || "").trim();
}
export function formatAcn(v: string): string {
  const d = digitsOnly(v);
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : (v || "").trim();
}
export function fmtDay(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
export function initialsOf(name: string): string {
  return (name || "").split(" ").filter((w) => /[a-z]/i.test(w[0] || "")).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
