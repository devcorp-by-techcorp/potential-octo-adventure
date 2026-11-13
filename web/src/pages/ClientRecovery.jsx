import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clientApi } from "@/lib/studio-api";

let captured = "";
function captureToken() {
  if (window.location.hash) {
    captured = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
  }
  return captured;
}

export default function ClientRecovery() {
  const [token, setToken] = useState(captureToken);
  const [enabled, setEnabled] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    clientApi("/auth/client/recovery/status", { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setEnabled(data.enabled);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => { controller.abort(); captured = ""; };
  }, [attempt]);
  async function submit(event) {
    event.preventDefault(); setError(""); setNotice("");
    if (token && password !== confirmation) { setError("Passwords must match."); return; }
    setBusy(true);
    try {
      const data = await clientApi(`/auth/client/recovery/${token ? "reset" : "request"}`, {
        body: token ? { token, password } : { email },
      });
      setNotice(data.message);
      if (token) { captured = ""; setToken(""); setPassword(""); setConfirmation(""); }
    } catch (failure) {
      setError(`${failure.message}${token ? " If your previous attempt may have succeeded, try signing in with the new password before requesting another link." : ""}`);
      setPassword(""); setConfirmation("");
    } finally { setBusy(false); }
  }
  return <main className="portal-entry studio-entry">
    <h1>Client password recovery</h1>
    <p>Recovery changes your password and ends existing client sessions. It does not create an account or change enquiry access.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {enabled === null ? <p>Checking recovery availability…</p> : !enabled
      ? <p>Self-service recovery is unavailable. Contact your studio administrator for account recovery.</p>
      : <form className="studio-signin" onSubmit={submit}>
        {token ? <>
          <label htmlFor="recovery-password">New client password</label>
          <input id="recovery-password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
          <label htmlFor="recovery-confirmation">Confirm new client password</label>
          <input id="recovery-confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
        </> : <>
          <label htmlFor="recovery-email">Client account email</label>
          <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} />
        </>}
        <button className="studio-button primary" disabled={busy}>{busy ? "Please wait…" : token ? "Change client password" : "Request recovery email"}</button>
      </form>}
    {error && <button className="studio-button secondary" disabled={busy} onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Check recovery availability</button>}
    <Link className="studio-button secondary" to="/client">Client sign-in</Link>
  </main>;
}
