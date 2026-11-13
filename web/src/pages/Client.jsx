import EnquiryDocuments from "@/pages/EnquiryDocuments";
import AccountSessions from "@/pages/AccountSessions";
import EnquiryConversation from "@/pages/EnquiryConversation";
import { ClientBookingDraft } from "@/pages/BookingDrafts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { clientApi } from "@/lib/studio-api";
import { captureInvitation, clearInvitation } from "@/lib/invitation-secret";
import { studioEmail } from "@/data/studio";
import { Inbox } from "lucide-react";
import PortalShell from "@/components/PortalShell";

const navigation = [{ label: "Your enquiries", to: "/client/home", matches: ["/client/enquiries/"], icon: Inbox }];

export default function Client() {
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [invitationToken, setInvitationToken] = useState(captureInvitation);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const email = useRef(null);
  const requests = useRef(new Set());
  const live = useRef(false);
  const accepting = pathname === "/client/accept";
  const privatePage = pathname === "/client/home" || pathname.startsWith("/client/enquiries/");
  const unauthorized = useCallback(() => {
    setSession(null);
    navigate("/client", { replace: true, state: { expired: true } });
  }, [navigate]);

  useEffect(() => {
    live.current = true;
    const pending = requests.current;
    const changed = () => setInvitationToken(captureInvitation());
    window.addEventListener("client-invitation-changed", changed);
    return () => {
      live.current = false; pending.forEach((request) => request.abort()); clearInvitation();
      window.removeEventListener("client-invitation-changed", changed);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const pending = requests.current;
    setSession(null); setLoading(true); setReady(false); setError("");
    clientApi("/auth/client/session", { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setSession(data); setReady(true);
      if (!privatePage && !accepting) navigate("/client/home", { replace: true });
    }).catch((failure) => {
      if (controller.signal.aborted || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) {
        setReady(true);
        if (privatePage) unauthorized();
      } else setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      pending.forEach((request) => request.abort());
      setBusy(false);
    };
  }, [pathname, privatePage, accepting, attempt, navigate, unauthorized]);
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") {
        setSession(null); setAttempt((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);
  useEffect(() => {
    if (!session?.expires_in_seconds) return;
    const timer = setTimeout(() => { setSession(null); setAttempt((value) => value + 1); }, session.expires_in_seconds * 1000);
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => { if (error && !busy) email.current?.focus(); }, [error, busy]);

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const controller = new AbortController(); requests.current.add(controller);
    setBusy(true); setError("");
    try {
      const data = await clientApi("/auth/client/login", { signal: controller.signal,
        body: { email: values.get("email"), password: values.get("password") } });
      if (!live.current || controller.signal.aborted) return;
      form.reset(); setSession(data);
      if (!accepting) navigate("/client/home", { replace: true });
    } catch (failure) {
      if (!live.current || controller.signal.aborted) return;
      setError(failure.message); form.elements.password.value = "";
    } finally {
      requests.current.delete(controller);
      if (live.current && !controller.signal.aborted) setBusy(false);
    }
  }
  async function signOut() {
    const controller = new AbortController(); requests.current.add(controller);
    setBusy(true); setError("");
    try {
      await clientApi("/auth/client/logout", { body: {}, csrf: session.csrf_token, signal: controller.signal });
      if (!live.current || controller.signal.aborted) return;
      setSession(null);
      if (!accepting) navigate("/client", { replace: true, state: { signedOut: true } });
    } catch (failure) {
      if (!live.current || controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) { setSession(null); if (!accepting) unauthorized(); }
      else setError(failure.message);
    } finally {
      requests.current.delete(controller);
      if (live.current && !controller.signal.aborted) setBusy(false);
    }
  }
  const signInForm = (intendedEmail = "") => <form className="studio-signin" onSubmit={signIn} aria-busy={busy}>
    <label htmlFor="client-email">Client email</label>
    <input ref={email} id="client-email" name="email" type="email" defaultValue={intendedEmail}
      autoComplete="username" required maxLength={254} disabled={busy} />
    <label htmlFor="client-password">Password</label>
    <input id="client-password" name="password" type="password" autoComplete="current-password"
      required maxLength={1024} disabled={busy} />
    <button className="studio-button primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
  </form>;
  if (privatePage && session && !loading && ready) return <PortalShell role="Client" title="Your enquiries"
    identity={session.identity} items={navigation} busy={busy} onSignOut={signOut}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {pathname === "/client/home" && <AccountSessions session={session} scope="client" onUnauthorized={unauthorized} />}
    <ClientEnquiries session={session} key={session.identity.id + pathname} onUnauthorized={unauthorized} />
  </PortalShell>;
  return <main className={`portal-entry studio-entry${privatePage ? " studio-inbox-shell" : ""}`}>
    <img src="/brand/lens-gold.png" alt="" width="64" height="64" />
    <p className="eyebrow">Illuminate Studios</p>
    <h1>{accepting ? "Accept your invitation" : privatePage ? "Your enquiries" : "Client sign-in"}</h1>
    {loading ? <p role="status">Checking your client session…</p> : <>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!ready ? <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button> : <>
        {session && <>
          <p className="studio-identity">Signed in as {session.identity.email}</p>
          <button className="studio-button primary" disabled={busy} onClick={signOut}>{busy ? "Working…" : "Sign out"}</button>
          {pathname === "/client/home" && <AccountSessions session={session} scope="client" onUnauthorized={unauthorized} />}
        </>}
        {accepting ? <Acceptance key={invitationToken} token={invitationToken} session={session} signInForm={signInForm} onAccepted={(data) => {
          clearInvitation(); setSession(data); navigate(`/client/enquiries/${data.enquiry_id}`, { replace: true });
        }} onDenied={() => setSession(null)} onSessionRestored={setSession} /> : privatePage ? session &&
          <ClientEnquiries session={session} key={session.identity.id + pathname} onUnauthorized={unauthorized} /> : <>
          {state?.expired && <p role="status">Your client session has expired or access has changed. Please sign in again.</p>}
          {state?.signedOut && <p role="status">You have signed out.</p>}
          {signInForm()}
          <p>Client access requires a studio invitation. For help or password recovery, contact <a href={`mailto:${studioEmail}`}>{studioEmail}</a>.</p>
        </>}
      </>}
    </>}
    <Link className="studio-button secondary" to="/">Back to the studio</Link>
  </main>;
}

function Acceptance({ token, session, signInForm, onAccepted, onDenied, onSessionRestored }) {
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef(null);
  const live = useRef(false);
  const passwordInput = useRef(null);
  const acceptButton = useRef(null);
  useEffect(() => {
    live.current = true;
    const request = new AbortController(); controller.current = request;
    setError(""); setInvitation(null); setBusy(false);
    if (token) clientApi("/auth/client/invitations/inspect", { body: { token }, signal: request.signal })
      .then((data) => { if (!request.signal.aborted) { setInvitation(data); if (data.status === "pending") setUncertain(false); } })
      .catch((failure) => { if (!request.signal.aborted) setError(failure.message); });
    return () => { live.current = false; controller.current?.abort(); };
  }, [token, attempt, session?.identity.id]);
  useEffect(() => {
    if (error && !busy) (passwordInput.current || acceptButton.current)?.focus();
  }, [error, busy]);
  useEffect(() => {
    if (session && invitation?.existing_account) acceptButton.current?.focus();
  }, [session, invitation]);
  async function submit(event, recover = false) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password?.value;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const data = await clientApi("/auth/client/invitations/accept", {
        signal: request.signal, csrf: session?.csrf_token,
        body: { token, ...(password ? { password } : {}), ...(recover ? { recover: true } : {}) },
      });
      if (!live.current || request.signal.aborted) return;
      form.reset(); onAccepted(data);
    } catch (failure) {
      if (!live.current || request.signal.aborted) return;
      setError(failure.message);
      if (failure.status === 401 || failure.status === 403) onDenied();
      if (form.elements.password) form.elements.password.value = "";
      if (!failure.status || failure.status === 503) {
        setUncertain(true);
        // A committed response may install its cookie before its body is lost.
        // Restore verified identity and memory-only CSRF before recovery.
        try {
          const restored = await clientApi("/auth/client/session", { signal: request.signal });
          if (live.current && !request.signal.aborted) onSessionRestored(restored);
        } catch {
          // Without a verified session, recovery still requires the password.
        }
      }
    } finally { if (live.current && !request.signal.aborted) setBusy(false); }
  }
  if (!token) return <><p role="alert">This invitation is invalid or its secret is missing. Reopen the original invitation link.</p><Link to="/client">Client sign-in</Link></>;
  const needsPassword = !session && (uncertain || invitation?.status === "accepted" || !invitation?.existing_account);
  return <section className="studio-inbox">
    {error && <p role="alert" className="form-error">{error}</p>}
    {!invitation ? <>
      {!error && <p role="status">Checking invitation…</p>}
      {error && <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Check invitation again</button>}
    </> : <>
      {invitation.status !== "pending" && <p role="status">This invitation is {invitation.status}.
        {invitation.status === "accepted" ? " Sign in to view completed access, or recover a completed enrollment below." : " Ask the studio for a replacement."}</p>}
      {invitation.status === "pending" && <>
        <p className="studio-identity">Invitation for {invitation.email}. This grants read-only access to one pending enquiry.</p>
        {invitation.existing_account && !session && <><p>Sign in as the invited client. Your password will remain unchanged.</p>{signInForm(invitation.email)}</>}
        {session && session.identity.email !== invitation.email && <p role="alert">Sign out and use the invited client account.</p>}
      </>}
      {invitation.status === "accepted" && !session && signInForm()}
      {(uncertain || invitation.status === "accepted") && <p>Acceptance may already be complete. Recovery checks the saved outcome; it does not create another account or grant. Use your original enrollment password, or your matching signed-in account.</p>}
      {(invitation.status === "accepted" || uncertain || (invitation.status === "pending" &&
        (!invitation.existing_account || session?.identity.email === invitation.email))) && <form className="studio-signin" aria-busy={busy}
          onSubmit={(event) => submit(event, uncertain || invitation.status === "accepted")}>
        {needsPassword && <>
          <label htmlFor="enrollment-password">{uncertain || invitation.status === "accepted" ? "Original enrollment password" : "Choose a password"}</label>
          <input ref={passwordInput} id="enrollment-password" name="password" type="password"
            autoComplete={uncertain || invitation.status === "accepted" ? "current-password" : "new-password"}
            minLength={12} maxLength={1024} required disabled={busy} />
          <p>Use 12–1,024 characters. Existing accounts must sign in; invitations cannot reset passwords.</p>
        </>}
        <button ref={acceptButton} className="studio-button primary" type="submit" disabled={busy}>
          {busy ? "Checking access…" : uncertain || invitation.status === "accepted" ? "Recover completed acceptance" : "Accept invitation"}
        </button>
      </form>}
      <button className="studio-button secondary" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Check invitation status</button>
    </>}
    <Link className="studio-button secondary" to="/client">Client sign-in</Link>
  </section>;
}

function ClientEnquiries({ onUnauthorized, session }) {
  const { enquiryId } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef(null);
  const cursor = params.get("cursor");
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    const path = enquiryId ? `/client/enquiries/${encodeURIComponent(enquiryId)}`
      : "/client/enquiries" + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");
    const request = enquiryId ? clientApi(path, { signal: controller.signal })
      : Promise.all([clientApi(path, { signal: controller.signal }), clientApi("/client/bookings", { signal: controller.signal })])
        .then(([result, bookings]) => ({ ...result, bookings }));
    request.then((result) => {
      if (!controller.signal.aborted) { setData(result); heading.current?.focus(); }
    }).catch((failure) => {
      if (controller.signal.aborted || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => controller.abort();
  }, [enquiryId, cursor, attempt, onUnauthorized]);
  return <section className="studio-inbox">
    <h2 ref={heading} tabIndex={-1}>{enquiryId && data ? data.reference : "Your enquiry access"}</h2>
    <p>Read-only enquiries awaiting studio confirmation. No availability is reserved and no booking is confirmed.</p>
    {error ? <><p className="form-error" role="alert">{error}</p>
      <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
    </> : !data ? <p role="status">Loading your enquiries…</p> : enquiryId ? <dl className="enquiry-details">
      {[["Name", data.name], ["Email", data.email], ["Phone", data.phone || "Not supplied"],
        ["Event type", data.event_type], ["Preferred date", data.preferred_date.split("-").reverse().join("/")],
        ["Collection", data.collection], ["Venue", data.venue || "Not supplied"],
        ["Customer message", data.message || "Not supplied"], ["Consent", data.consent ? "Given" : "Not given"],
        ["Received", new Date(data.created_at).toLocaleString("en-AU", { timeZone: "UTC" }) + " UTC"]]
        .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl> : <>
      <h3>Your booking progress</h3>
      {!data.bookings.length ? <p>No linked planning booking is available yet.</p> : <ul className="inbox-list">
        {data.bookings.map((booking) => <li key={booking.id} className="enquiry-link">
          <strong>{booking.reference}</strong><span>{booking.event_type} · {booking.scheduled_date.split("-").reverse().join("/")}</span>
          <span>{booking.state.replaceAll("_", " ")}</span>
        </li>)}
      </ul>}
      <h3>Your enquiries</h3>
      <p role="status">{data.items.length ? `${data.items.length} enquiries on this page.` : "No enquiry access has been granted."}</p>
      <ul className="inbox-list">{data.items.map((item) => <li key={item.id}>
        <Link className="enquiry-link" to={`/client/enquiries/${item.id}`}>{item.reference} · {item.event_type} · {item.preferred_date.split("-").reverse().join("/")}</Link>
      </li>)}</ul>
      <nav className="inbox-actions" aria-label="Client enquiry pages">
        {cursor && <button className="studio-button secondary" onClick={() => setParams({})}>First page</button>}
        {data.next_cursor && <button className="studio-button secondary" onClick={() => setParams({ cursor: data.next_cursor })}>Next page</button>}
      </nav>
    </>}
    {enquiryId && data && <EnquiryDocuments enquiryId={enquiryId} session={session} scope="client" onUnauthorized={onUnauthorized} />}
    {enquiryId && data && <EnquiryConversation enquiryId={enquiryId} session={session} scope="client" onUnauthorized={onUnauthorized} />}
    {enquiryId && data && <ClientBookingDraft enquiryId={enquiryId} onUnauthorized={onUnauthorized} />}
    {enquiryId && <Link className="studio-button secondary" to="/client/home">Back to your enquiries</Link>}
  </section>;
}
