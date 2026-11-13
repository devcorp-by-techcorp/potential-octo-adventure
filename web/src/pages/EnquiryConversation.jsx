import { useCallback, useEffect, useRef, useState } from "react";
import { privateApi } from "@/lib/studio-api";

export default function EnquiryConversation({ enquiryId, session, scope = "studio", onUnauthorized }) {
  const [participants, setParticipants] = useState([]);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const pending = useRef(null);
  const path = scope === "client" ? `/client/enquiries/${enquiryId}/conversation`
    : clientId ? `/studio/enquiries/${enquiryId}/conversations/${clientId}` : "";
  const livePath = useRef(path);
  livePath.current = path;
  const options = { scope: scope === "client" ? "Client" : "Studio", csrf: session.csrf_token };

  const failure = useCallback((problem) => {
    if (problem.status === 401 || problem.status === 403) onUnauthorized();
    else {
      setError(problem.message);
      if (problem.status === 404) { setItems([]); setPage(null); }
    }
  }, [onUnauthorized]);

  useEffect(() => {
    if (scope !== "studio") return;
    const controller = new AbortController();
    privateApi(`/studio/enquiries/${enquiryId}/client-access`, { signal: controller.signal })
      .then((grants) => {
        if (controller.signal.aborted) return;
        const active = grants.filter((grant) => !grant.revoked_at);
        setParticipants(active);
        setClientId((selected) => active.some((grant) => grant.client_id === selected) ? selected : active[0]?.client_id || "");
      }).catch((problem) => { if (!controller.signal.aborted) failure(problem); });
    return () => controller.abort();
  }, [enquiryId, scope, refresh, failure]);

  useEffect(() => { setText(""); setBusy(false); pending.current = null; }, [path]);

  useEffect(() => {
    setItems([]); setPage(null); setError("");
    if (!path) return;
    const controller = new AbortController();
    privateApi(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setItems(data.items); setPage(data); }
    }).catch((problem) => { if (!controller.signal.aborted) failure(problem); });
    return () => controller.abort();
  }, [path, refresh, failure]);

  async function more() {
    setBusy(true); setError("");
    try {
      const data = await privateApi(`${path}?after=${page.next_cursor}`);
      if (livePath.current !== path) return;
      setItems((existing) => [...existing, ...data.items]); setPage(data);
    } catch (problem) { if (livePath.current === path) failure(problem); } finally { if (livePath.current === path) setBusy(false); }
  }
  async function send(event) {
    event.preventDefault(); setBusy(true); setError("");
    pending.current ||= { id: crypto.randomUUID(), text: text.trim() };
    try {
      const sent = await privateApi(`${path}/messages`, { ...options, body: pending.current });
      if (livePath.current !== path) return;
      pending.current = null; setText("");
      const data = await privateApi(`${path}?after=${items.at(-1)?.sequence || 0}`);
      if (livePath.current !== path) return;
      setItems((existing) => [...existing, ...data.items.filter((message) => !existing.some((item) => item.id === message.id))]);
      setPage(data);
      // The server-assigned sequence confirms the committed outcome of a retry.
      if (!sent.sequence) throw new Error("Refresh the conversation to check delivery.");
    } catch (problem) { if (livePath.current === path) failure(problem); } finally { if (livePath.current === path) setBusy(false); }
  }
  async function read() {
    setBusy(true); setError("");
    try {
      const result = await privateApi(`${path}/read`, { ...options, body: { sequence: items.at(-1)?.sequence || 0 } });
      if (livePath.current !== path) return;
      setPage((previous) => ({ ...previous, read_sequence: result.read_sequence,
        unread_count: previous.unread_count - items.filter((item) => item.sender_scope !== scope && item.sequence > previous.read_sequence && item.sequence <= result.read_sequence).length }));
    } catch (problem) { if (livePath.current === path) failure(problem); } finally { if (livePath.current === path) setBusy(false); }
  }

  return <section className="studio-inbox" aria-label="Client and studio conversation">
    <h3>Client and studio messages</h3>
    <p>Messages do not confirm a booking or reserve availability. Studio notes are separate.</p>
    <button className="studio-button secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh conversation</button>
    {scope === "studio" && <label>Conversation client<select aria-label="Conversation client" disabled={busy} value={clientId} onChange={(event) => setClientId(event.target.value)}>
      {participants.map((grant) => <option key={grant.id} value={grant.client_id}>{grant.name} ({grant.email})</option>)}
    </select></label>}
    {scope === "studio" && !participants.length && <p>No active client access. An accepted invitation is required before messaging.</p>}
    {error && <p className="form-error" role="alert">{error} If delivery was uncertain, retry the same message before changing it.</p>}
    {page && <>
      <p role="status">{page.unread_count} unread messages{scope === "studio" ? " in the shared studio inbox" : ""}.</p>
      <ol className="inbox-list">{items.map((item) => <li key={item.id}>
        <p><strong>{item.sender_scope === "studio" ? "Studio" : "Client"}</strong> · <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.text}</p>
      </li>)}</ol>
      {items.length === 0 && <p>No messages yet.</p>}
      {page.next_cursor && <button className="studio-button secondary" disabled={busy} onClick={more}>Load more messages</button>}
      <button className="studio-button secondary" disabled={busy || !items.length} onClick={read}>Mark displayed messages read</button>
      <form onSubmit={send}>
        <label>Message to {scope === "studio" ? "client" : "studio"}<textarea aria-label="Conversation message" maxLength={2000} required readOnly={busy || !!pending.current} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <button className="studio-button" disabled={busy || !text.trim()}>{busy ? "Sending…" : pending.current ? "Retry same message" : "Send message"}</button>
      </form>
    </>}
  </section>;
}
