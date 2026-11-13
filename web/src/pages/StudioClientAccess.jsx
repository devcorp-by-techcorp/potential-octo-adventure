import { useEffect, useRef, useState } from "react";
import { studioApi } from "@/lib/studio-api";

export default function StudioClientAccess({ id, session, onUnauthorized, onRevoked }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const path = `/studio/enquiries/${encodeURIComponent(id)}/client-access`;
  const activePath = useRef(path);
  activePath.current = path;
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setItems(null);
    setNotice("");
    studioApi(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setItems(data);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => controller.abort();
  }, [path, attempt, onUnauthorized]);
  async function revoke(grant) {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await studioApi(`${path}/${grant.id}/revoke`, { body: {}, csrf: session.csrf_token });
      if (activePath.current !== path) return;
      setItems((values) => (values || []).map((item) => item.id === data.id ? data : item));
      onRevoked();
      setNotice("Client access revoked. Pending invitations were also revoked. Issue a new invitation to restore access.");
    } catch (failure) {
      if (activePath.current !== path) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(`${failure.message} Refresh access status before retrying.`);
    } finally { setBusy(false); }
  }
  return <section className="studio-inbox" aria-labelledby="client-access-heading">
    <h3 id="client-access-heading">Client enquiry access</h3>
    <p>Withdraw access to this enquiry without disabling the client account or changing other enquiries. Shows the 100 most recently granted clients.</p>
    <button className="studio-button secondary" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh client access</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {items === null ? <p>Loading client access…</p> : <ul className="inbox-list">{items.map((item) => <li key={item.id}>
      <p>{item.name} · {item.email} · {item.revoked_at ? "Access revoked" : "Access active"}</p>
      {!item.revoked_at && <button className="studio-button secondary" disabled={busy} onClick={() => revoke(item)}>Revoke enquiry access</button>}
    </li>)}</ul>}
    {items?.length === 0 && <p>No accepted client access.</p>}
  </section>;
}
