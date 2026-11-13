import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, Contact, FileText, Home, Inbox, ListChecks, Settings, BarChart3, Image } from "lucide-react";
import PortalShell from "@/components/PortalShell";
import { studioEmail } from "@/data/studio";
import StudioContacts from "@/pages/StudioContacts";
import AccountSessions from "@/pages/AccountSessions";
import StudioContent from "@/pages/StudioContent";
import EnquiryOperations from "@/pages/EnquiryOperations";
import BookingResources from "@/pages/BookingResources";
import BookingDrafts from "@/pages/BookingDrafts";
import StudioReporting from "@/pages/StudioReporting";
import StudioEnquiries from "@/pages/StudioEnquiries";
import StudioBookings from "@/pages/StudioBookings";
import { studioApi } from "@/lib/studio-api";

const navigation = [
  { label: "Studio home", to: "/studio/home", icon: Home },
  { label: "Enquiry inbox", to: "/studio/enquiries", icon: Inbox },
  { label: "Bookings & tracker", to: "/studio/bookings", icon: CalendarDays },
  { label: "Client contacts", to: "/studio/contacts", icon: Contact },
  { label: "Website content", to: "/studio/content", icon: Image },
  { label: "Enquiry operations", to: "/studio/operations", icon: ListChecks },
  { label: "Booking resources", to: "/studio/booking-resources", icon: Settings },
  { label: "Booking proposals", to: "/studio/booking-drafts", icon: FileText },
  { label: "Reporting", to: "/studio/reporting", icon: BarChart3 },
];

export default function Studio() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const emailInput = useRef(null);
  const home = pathname !== "/studio";
  const contacts = pathname === "/studio/contacts";
  const content = pathname === "/studio/content";
  const operations = pathname === "/studio/operations";
  const resources = pathname === "/studio/booking-resources";
  const bookingDrafts = pathname === "/studio/booking-drafts";
  const reporting = pathname === "/studio/reporting";
  const inbox = pathname.startsWith("/studio/enquiries");
  const bookingOverview = pathname.startsWith("/studio/bookings");
  const onUnauthorized = useCallback(() => {
    setSession(null);
    navigate("/studio", { replace: true, state: { expired: true } });
  }, [navigate]);


  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSession(null);
    setLoading(true);
    setError("");
    async function restore() {
      try {
        const restored = await studioApi("/auth/session", { signal: controller.signal });
        if (home) {
          const protectedHome = await studioApi("/studio/home", { signal: controller.signal });
          restored.identity = protectedHome.identity;
        }
        if (!active) return;
        setSession(restored);
        if (!home) navigate("/studio/home", { replace: true });
      } catch (failure) {
        if (!active || failure.name === "AbortError") return;
        setSession(null);
        if (failure.status === 401 || failure.status === 403) {
          if (home) navigate("/studio", { replace: true, state: { expired: true } });
        } else {
          setError(failure.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => { active = false; controller.abort(); };
  }, [home, pathname, attempt, navigate]);

  // Recheck when returning to the tab, so revoked/expired identities cannot leave
  // stale identity content on screen. Every API request also enforces authorization.
  useEffect(() => {
    function recheck() {
      if (document.visibilityState === "visible") {
        setSession(null);
        setAttempt((value) => value + 1);
      }
    }
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);

  useEffect(() => {
    if (!session?.expires_in_seconds) return;
    const timeout = setTimeout(() => {
      setSession(null);
      setAttempt((value) => value + 1);
    }, session.expires_in_seconds * 1000);
    return () => clearTimeout(timeout);
  }, [session]);

  useEffect(() => {
    if (!busy && error && !home) emailInput.current?.focus();
  }, [busy, error, home]);

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const restored = await studioApi("/auth/login", {
        body: { email: values.get("email"), password: values.get("password") },
      });
      form.reset();
      setSession(restored);
      navigate("/studio/home", { replace: true });
    } catch (failure) {
      setError(failure.message);
      form.elements.password.value = "";
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await studioApi("/auth/logout", { body: {}, csrf: session.csrf_token });
      setSession(null);
      navigate("/studio", { replace: true, state: { signedOut: true } });
    } catch (failure) {
      if (failure.status === 401 || failure.status === 403) {
        setSession(null);
        navigate("/studio", { replace: true, state: { expired: true } });
      } else {
        setError(failure.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const title = home ? inbox ? "Studio enquiries" : bookingOverview ? "Bookings" : contacts ? "Client contacts" : content ? "Website content" : operations ? "Enquiry operations" : bookingDrafts ? "Booking proposals" : reporting ? "Studio reporting" : resources ? "Booking resources" : "Studio home" : "Studio sign-in";
  if (home && session && !loading) return <PortalShell role="Studio" title={title}
    identity={session.identity} items={navigation} busy={busy} onSignOut={signOut}>
    {error && <p id="studio-error" className="form-error" role="alert">{error}</p>}
    {contacts && <StudioContacts onUnauthorized={onUnauthorized} />}
    {pathname === "/studio/home" && <AccountSessions session={session} onUnauthorized={onUnauthorized} />}
    {content && <StudioContent session={session} onUnauthorized={onUnauthorized} />}
    {operations && <EnquiryOperations session={session} onUnauthorized={onUnauthorized} />}
    {resources && <BookingResources session={session} onUnauthorized={onUnauthorized} />}
    {bookingDrafts && <BookingDrafts session={session} onUnauthorized={onUnauthorized} />}
    {reporting && <StudioReporting onUnauthorized={onUnauthorized} />}
    {inbox && <StudioEnquiries key={session.identity.id} session={session} onUnauthorized={onUnauthorized} />}
    {bookingOverview && <StudioBookings key={session.identity.id + pathname} session={session} onUnauthorized={onUnauthorized} />}
    {!inbox && !bookingOverview && !bookingDrafts && !contacts && !content && !operations && !reporting && !resources && <StudioDashboard onUnauthorized={onUnauthorized} />}
  </PortalShell>;

  return (
    <main className="portal-entry studio-entry">
      <img src="/brand/lens-gold.png" alt="" width="64" height="64" />
      <p className="eyebrow">Illuminate Studios</p>
      <h1>{title}</h1>
      {loading ? <p role="status">Checking your session…</p> : <>
        {error && <p id="studio-error" className="form-error" role="alert">{error}</p>}
        {home ? <button className="studio-button primary" onClick={() => setAttempt((value) => value + 1)}>
          Try again
        </button> : <>
          {state?.expired && <p role="status">Your session has expired or access has changed. Please sign in again.</p>}
          {state?.signedOut && <p role="status">You have signed out.</p>}
          <form className="studio-signin" onSubmit={signIn} aria-busy={busy}>
            <label htmlFor="staff-email">Staff email</label>
            <input ref={emailInput} id="staff-email" name="email" type="email"
              aria-describedby={error ? "studio-error" : undefined}
              autoComplete="username" required maxLength={254} disabled={busy} />
            <label htmlFor="staff-password">Password</label>
            <input id="staff-password" name="password" type="password"
              aria-describedby={error ? "studio-error" : undefined}
              autoComplete="current-password" required maxLength={1024} disabled={busy} />
            <button className="studio-button primary" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {error && <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>
            Check service again
          </button>}
          <p>For access or a password reset, contact your studio administrator at <a href={`mailto:${studioEmail}`}>{studioEmail}</a>.</p>
        </>}
      </>}
      <Link className="studio-button secondary" to="/">Back to the studio</Link>
    </main>
  );
}

function StudioDashboard({ onUnauthorized }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    studioApi("/studio/dashboard", { signal: controller.signal }).then(setMetrics).catch((failure) => {
      if (failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => controller.abort();
  }, [onUnauthorized]);
  return <section className="studio-inbox"><h2>Operational overview</h2>
    <p>Live counts from authorised stored records. No sample or forecast data is shown.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : !metrics ? <p role="status">Loading overview…</p>
      : <dl className="enquiry-details"><div><dt>Active enquiries</dt><dd className="numeric">{metrics.active_enquiries}</dd></div>
        {Object.entries(metrics.bookings).map(([state, count]) => <div key={state}><dt>{state.replaceAll("_", " ")}</dt><dd className="numeric">{count}</dd></div>)}</dl>}
  </section>;
}
