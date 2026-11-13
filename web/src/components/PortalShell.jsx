import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import Dialog from "@/components/landing/Dialog";
import "./portal-shell.css";

export default function PortalShell({ role, title, identity, items, busy, onSignOut, children }) {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = items.findLast((item) => item.matches?.some((prefix) => pathname.startsWith(prefix)) || pathname === item.to ||
    (item.to !== "/studio/home" && item.to !== "/client/home" && pathname.startsWith(item.to + "/")));
  const primary = items.slice(0, 4);
  const remaining = items.slice(4);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1152px)");
    const close = () => setMoreOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  function destination(item) {
    const Icon = item.icon;
    return <Link key={item.to} to={item.to} aria-current={active === item ? "page" : undefined}
      onClick={() => setMoreOpen(false)}>
      <Icon size={18} strokeWidth={1.25} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>;
  }

  return <div className="portal-shell">
    <a className="skip-link" href="#portal-content">Skip to portal content</a>
    <aside className="portal-rail" aria-label={`${role} sidebar`}>
      <Link className="portal-brand" to="/" aria-label="Illuminate Studios website">
        <img src="/brand/lens-gold.png" alt="" width="36" height="36" />
        <span>Illuminate<span>Studios</span></span>
      </Link>
      <p className="eyebrow">{role}</p>
      <nav aria-label={`${role} navigation`}>{items.map(destination)}</nav>
      <Link className="portal-website" to="/">Back to the studio</Link>
    </aside>
    <div className="portal-workspace">
      <header className="portal-topbar">
        <div className="portal-heading"><p className="eyebrow">{role}</p><h1>{title}</h1></div>
        <button className="studio-button secondary" onClick={onSignOut} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </header>
      <main id="portal-content" className="portal-content" tabIndex={-1}>
        <div className="portal-identity">
          {identity.name && <p>Welcome, {identity.name}.</p>}
          <p className="studio-identity">Signed in as {identity.email}</p>
        </div>
        {children}
      </main>
    </div>
    <nav className="portal-compact-nav" aria-label={`${role} navigation`}>
      {primary.map(destination)}
      <button aria-label={`More ${role.toLowerCase()} navigation`} aria-haspopup="dialog"
        aria-expanded={moreOpen} className={remaining.includes(active) ? "is-current" : ""}
        onClick={() => setMoreOpen(true)}>
        <MoreHorizontal size={18} strokeWidth={1.25} aria-hidden="true" /><span>More</span>
      </button>
    </nav>
    {moreOpen && <Dialog title={`${role} navigation`} className="portal-nav-sheet" onClose={() => setMoreOpen(false)}>
      <nav aria-label={`More ${role.toLowerCase()} destinations`}>{items.map(destination)}</nav>
      <Link className="portal-website" to="/" onClick={() => setMoreOpen(false)}>Back to the studio</Link>
    </Dialog>}
  </div>;
}
