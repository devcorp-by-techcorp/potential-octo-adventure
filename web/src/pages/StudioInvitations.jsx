import { useEffect, useRef, useState } from "react";
import { studioApi } from "@/lib/studio-api";

const utc = (value) => new Date(value).toLocaleString("en-AU", { timeZone: "UTC" }) + " UTC";
export default function StudioInvitations({ id, email, session, onUnauthorized }) {
  const [result, setResult] = useState(null);
  const [grants, setGrants] = useState([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  const controller = useRef(null);
  const linkInput = useRef(null);
  const path = `/studio/enquiries/${encodeURIComponent(id)}/client-invitations`;
  const deny = (failure) => {
    if (failure.status === 401 || failure.status === 403) { setLink(""); onUnauthorized(); }
    else setError(failure.message);
  };
  useEffect(() => {
    active.current = true;
    const request = new AbortController();
    controller.current = request;
    setResult(null); setError("");
    Promise.all([
      studioApi(path + (cursor ? `?cursor=${cursor}` : ""), { signal: request.signal }),
      studioApi(`/studio/enquiries/${encodeURIComponent(id)}/client-access`, { signal: request.signal }),
    ]).then(([data, access]) => { if (!request.signal.aborted) { setResult(data); setGrants(access); } })
      .catch((failure) => {
        if (request.signal.aborted || failure.name === "AbortError") return;
        if (failure.status === 401 || failure.status === 403) onUnauthorized();
        else setError(failure.message);
      });
    return () => { active.current = false; controller.current?.abort(); };
  }, [path, id, cursor, attempt, onUnauthorized]);
  useEffect(() => { if (link) linkInput.current?.focus(); }, [link]);
  async function mutate(invitationId) {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(""); setNotice(""); setLink("");
    try {
      const data = await studioApi(invitationId
        ? `/studio/client-invitations/${invitationId}/revoke` : path,
      { body: {}, csrf: session.csrf_token, signal: request.signal });
      if (!active.current || request.signal.aborted) return;
      if (!invitationId) setLink(data.link);
      setNotice(invitationId ? "Pending invitation revoked." : "Invitation issued. Copy it for manual delivery.");
      setCursor(null); setAttempt((value) => value + 1);
    } catch (failure) {
      if (!active.current || request.signal.aborted) return;
      deny(failure);
      setNotice("Check invitation status before retrying. Issuing again replaces any pending link.");
    } finally { if (active.current && !request.signal.aborted) setBusy(false); }
  }
  async function revokeGrant(grantId) {
    setBusy(true); setError(""); setNotice("");
    try {
      await studioApi(`/studio/client-access/${grantId}`, { method: "DELETE", csrf: session.csrf_token });
      setNotice("Accepted access revoked. Linked enquiry and booking views are no longer available to this client.");
      setAttempt((value) => value + 1);
    } catch (failure) { deny(failure); }
    finally { setBusy(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      if (active.current) { setNotice("Invitation link copied. Deliver through your trusted channel."); linkInput.current?.focus(); }
    } catch {
      if (active.current) { setNotice("Select the link and copy it manually."); linkInput.current?.focus(); linkInput.current?.select(); }
    }
  }
  return <section className="studio-inbox" aria-labelledby="invitations-heading">
    <h3 id="invitations-heading">Client invitations</h3>
    <p>Invite the saved contact, {email}. Access covers only this enquiry. No booking is confirmed and no email is sent.</p>
    <p>A new invitation revokes any pending invitation for this enquiry. Accepted access remains available.</p>
    <h4>Accepted access</h4>
    {!grants.length ? <p>No accepted access is active.</p> : <ul className="inbox-list">{grants.map((grant) => <li key={grant.id}>
      <p>Client {grant.client_id} · granted {utc(grant.granted_at)}</p>
      <button className="studio-button secondary" disabled={busy} onClick={() => revokeGrant(grant.id)}>Revoke this accepted access</button>
    </li>)}</ul>}
    <div className="inbox-actions">
      <button className="studio-button primary" disabled={busy || !result} onClick={() => mutate()}>Issue invitation</button>
      <button className="studio-button secondary" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh invitation status</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {link && <div className="studio-signin invitation-link">
      <label htmlFor="invitation-link">Invitation link (shown once)</label>
      <input ref={linkInput} id="invitation-link" readOnly value={link} onFocus={(event) => event.target.select()} />
      <button className="studio-button secondary" onClick={copy}>Copy invitation link</button>
    </div>}
    {!result ? <p>Loading invitation status…</p> : <>
      <ul className="inbox-list">{result.items.map((item) => <li key={item.id}>
        <p>Invitation {item.status} · Expires {utc(item.expires_at)}</p>
        {item.status === "pending" && <button className="studio-button secondary" disabled={busy} onClick={() => mutate(item.id)}>Revoke pending invitation</button>}
      </li>)}</ul>
      {!result.items.length && <p>No invitations issued yet.</p>}
      <div className="inbox-actions">
        {cursor && <button className="studio-button secondary" onClick={() => setCursor(null)}>Latest invitations</button>}
        {result.next_cursor && <button className="studio-button secondary" onClick={() => setCursor(result.next_cursor)}>Older invitations</button>}
      </div>
    </>}
  </section>;
}
