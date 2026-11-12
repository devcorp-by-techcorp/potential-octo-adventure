import { AppShell, NavItem } from "~/components/AppShell";
import { usePortal } from "~/state/portal";

export default function ClientLayout() {
  const { unread } = usePortal();
  const items: NavItem[] = [
    { name: "home", label: "Home", icon: "sparkle", href: "/(client)/home" },
    { name: "gallery", label: "Gallery", icon: "image", href: "/(client)/gallery" },
    { name: "inbox", label: "Inbox", icon: "inbox", href: "/(client)/inbox", badge: unread },
    { name: "documents", label: "Docs", icon: "doc", href: "/(client)/documents" },
    { name: "prints", label: "Prints", icon: "gallery", href: "/(client)/prints" },
  ];
  return <AppShell items={items} roleLabel="Client Portal" />;
}
