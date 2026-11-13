import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PortalEntry() {
  return (
    <main className="portal-entry">
      <img src="/brand/lens-gold.png" alt="" width="64" height="64" />
      <p className="eyebrow">Illuminate Studios</p>
      <h1>Page not found</h1>
      <p>We couldn’t find that page. Your story can begin at the studio’s home page.</p>
      <Link className="studio-button secondary" to="/">
        <ArrowLeft size={16} />
        Back to the studio
      </Link>
    </main>
  );
}
