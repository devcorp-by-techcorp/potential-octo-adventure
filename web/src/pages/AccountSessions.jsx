import { useEffect, useRef, useState } from "react";
import { clientApi, studioApi } from "@/lib/studio-api";

export default function AccountSessions({ session, scope = "staff", onUnauthorized }) {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(null);
  const command = useRef(null);
  const api = scope === "client" ? clientApi : studioApi;
  const path = scope === "client" ? "/auth/client/sessions" : "/auth/sessions";

  useEffect(() => {
    const request = new AbortController();
    setCounts(null); setError("");
    api(path, { signal: request.signal }).then((data) => {
      if (!request.signal.aborted) setCounts(data);
    }).catch((failure) => {
      if (request.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => { request.abort(); pending.current?.abort(); };
  }, [api, path, attempt, onUnauthorized]);

  async function revoke() {
    if (pending.current) return;
    const request = new AbortController(); pending.current = request;
    command.current ||= crypto.randomUUID();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api(path + "/revoke-others", {
        body: { id: command.current }, csrf: session.csrf_token, signal: request.signal,
      });
      if (request.signal.aborted) return;
      command.current = null;
      setNotice(`${result.revoked_count} other sessions signed out. This session stays signed in.`);
      setAttempt((value) => value + 1);
    } catch (failure) {
      if (request.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError("The result could not be confirmed. Retry the same action to check its saved outcome.");
    } finally {
      pending.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <section className="studio-inbox" aria-label="Account sessions">
    <h2>Account sessions</h2>
    <p>Sign out other active sessions for your account. This browser stays signed in. Anyone with your password can sign in again.</p>
    {counts ? <p>{counts.other_active_sessions} other active sessions.</p> : !error && <p role="status">Checking active sessions…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="inbox-actions">
      <button className="studio-button secondary" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh sessions</button>
      <button className="studio-button primary" disabled={busy || (!command.current && (!counts || counts.other_active_sessions === 0))} onClick={revoke}>
        {busy ? "Signing out other sessions…" : command.current ? "Retry session sign-out" : "Sign out other sessions"}
      </button>
    </div>
  </section>;
}
