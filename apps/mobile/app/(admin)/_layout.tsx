import { AppShell, NavItem } from "~/components/AppShell";
import { FinanceProvider } from "~/state/finance";
import { INQUIRIES_FULL } from "~/data/seed";

/**
 * The nine studio-admin surfaces, in design-system order and icon vocabulary.
 * Nothing from the client portal belongs here — the pre-shoot intake is a
 * client surface and Luma is reached from the header, not the nav.
 */
const items: NavItem[] = [
  { name: "dashboard", label: "Dashboard", icon: "sparkle", href: "/(admin)/dashboard" },
  { name: "bookings", label: "Bookings", icon: "calendar", href: "/(admin)/bookings" },
  { name: "inquiries", label: "Inquiries", icon: "inbox", href: "/(admin)/inquiries", badge: INQUIRIES_FULL.filter((q) => q.status === "new").length },
  { name: "tracker", label: "Shoot Tracker", icon: "camera", href: "/(admin)/tracker" },
  { name: "illuminate-kids", label: "Illuminate Kids", icon: "heart", href: "/(admin)/illuminate-kids" },
  { name: "contacts", label: "Contacts", icon: "users", href: "/(admin)/contacts" },
  { name: "staff", label: "Studio Staff", icon: "user", href: "/(admin)/staff" },
  { name: "documents", label: "Documents", icon: "doc", href: "/(admin)/documents" },
  { name: "finance", label: "Finance", icon: "pricing", href: "/(admin)/finance" },
  { name: "content", label: "Site Content", icon: "settings", href: "/(admin)/content" },
];

export default function AdminLayout() {
  return (
    <FinanceProvider>
      <AppShell items={items} roleLabel="Studio Admin" maxTabs={4} />
    </FinanceProvider>
  );
}
