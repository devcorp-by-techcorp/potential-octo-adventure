import { useEffect, useState } from "react";
import { studioApi, clientApi } from "@/lib/studio-api";

const stamp = (value, zone) => new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value));

export function ClientBookingDraft({ enquiryId, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    clientApi(`/client/enquiries/${enquiryId}/booking-draft`, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setData(value);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => controller.abort();
  }, [enquiryId, onUnauthorized]);
  return <section><h3>Booking preparation</h3>
    {error && <p role="alert">{error}</p>}
    {data?.draft ? <p>Proposal {data.draft.state}: {stamp(data.draft.starts_at, data.draft.timezone)} to {stamp(data.draft.ends_at, data.draft.timezone)} ({data.draft.timezone}).</p> : <p>No saved booking proposal is shown.</p>}
    <p>A proposal reserves no availability and confirms no booking. The studio must agree the booking separately.</p>
  </section>;
}

export function BookingPreparation({ enquiryId, session, onUnauthorized }) {
  return <BookingForm enquiryId={enquiryId} session={session} onUnauthorized={onUnauthorized} />;
}

function BookingForm({ enquiryId, draft, session, onUnauthorized, onSaved }) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  async function save(event, action) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const proposed = {
      starts_at: values.get("starts_at"), ends_at: values.get("ends_at"), timezone: values.get("timezone"),
      ...(draft ? { expected_revision: draft.revision, action } : {}),
    };
    // Reuse the exact command after an uncertain response; altered input is a
    // new operation and will still need a current revision from the server.
    const key = JSON.stringify(proposed);
    const command = pending?.key === key ? pending.id : crypto.randomUUID();
    setPending({ key, id: command }); setBusy(true); setError(""); setNotice("");
    try {
      const value = await studioApi(draft ? `/studio/booking-drafts/${draft.id}` : `/studio/enquiries/${enquiryId}/booking-draft`, {
        method: draft ? "PATCH" : "POST", csrf: session.csrf_token, body: { ...proposed, command_id: command },
      });
      setPending(null); setNotice("Booking proposal saved. No availability reserved."); onSaved?.(value);
    } catch (failure) {
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(`${failure.message} Reload drafts to check the saved outcome before changing the proposal.`);
    } finally { setBusy(false); }
  }
  return <section className="studio-inbox"><h3>{draft ? `Edit proposal ${draft.reference}` : "Prepare a booking proposal"}</h3>
    <p>Proposals reserve no availability. Confirmation is disabled until resource capacity, scheduling, approval, contract and payment checks are implemented.</p>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="inbox-editor" onSubmit={(event) => save(event, event.nativeEvent.submitter?.value || "reschedule")} aria-busy={busy}>
      <label>Start with timezone offset<input name="starts_at" type="text" placeholder="2099-12-20T10:00:00+11:00" required defaultValue={draft?.starts_at || ""} disabled={busy} /></label>
      <label>End with timezone offset<input name="ends_at" type="text" placeholder="2099-12-20T12:00:00+11:00" required defaultValue={draft?.ends_at || ""} disabled={busy} /></label>
      <label>IANA timezone<input name="timezone" type="text" placeholder="Australia/Melbourne" required defaultValue={draft?.timezone || ""} disabled={busy} /></label>
      <p>Use UTC (+00:00) or local times with the selected timezone’s correct offset.</p>
      <button className="studio-button primary" disabled={busy} value="reschedule">{busy ? "Saving…" : "Save proposal"}</button>
      {draft && <button className="studio-button secondary" disabled={busy} value="cancel">Cancel proposal</button>}
    </form>
  </section>;
}

export default function BookingDrafts({ session, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyAfter, setHistoryAfter] = useState(-1);
  const [historyDraft, setHistoryDraft] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(""); setEditing(null);
    studioApi(`/studio/booking-drafts?offset=${offset}`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setData(result);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
    });
    return () => controller.abort();
  }, [offset, attempt, onUnauthorized]);
  useEffect(() => {
    if (!historyDraft) return;
    const controller = new AbortController(); setHistory(null);
    studioApi(`/studio/booking-drafts/${historyDraft}/history?after=${historyAfter}`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setHistory(result);
    }).catch((failure) => { if (!controller.signal.aborted) {
      if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
    } });
    return () => controller.abort();
  }, [historyDraft, historyAfter, attempt, onUnauthorized]);
  return <section className="studio-inbox"><h2>Booking proposals</h2>
    <p>This planning calendar shows persisted proposals, including cancelled proposals. It is not an availability calendar. No proposal confirms a booking or reserves capacity.</p>
    <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Reload proposals</button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!data ? <p role="status">Loading proposals…</p> : <>
      <p role="status">{data.items.length} proposals on this page.</p>
      <ul className="inbox-list">{data.items.map((item) => <li key={item.id}>
        <p>{item.reference} · {item.state} · {stamp(item.starts_at, item.timezone)} — {stamp(item.ends_at, item.timezone)} ({item.timezone})</p>
        {item.state === "draft" && <button className="studio-button secondary" onClick={() => setEditing(item)}>Edit proposal {item.reference}</button>}
        <button className="studio-button secondary" onClick={() => { setHistoryDraft(item.id); setHistoryAfter(-1); }}>Change history {item.reference}</button>
      </li>)}</ul>
      <nav aria-label="Proposal pages">{offset > 0 && <button onClick={() => setOffset(0)}>First page</button>}{data.next_offset !== null && <button onClick={() => setOffset(data.next_offset)}>Next page</button>}</nav>
    </>}
    {editing && <BookingForm key={`${editing.id}-${editing.revision}`} draft={editing} session={session} onUnauthorized={onUnauthorized} onSaved={() => setAttempt((value) => value + 1)} />}
    {history && <section><h3>Proposal history</h3><ul>{history.items.map((item) => <li key={item.revision}>Revision {item.revision} · {item.action} · {item.actor_id} · {new Date(item.at).toISOString()}</li>)}</ul>{history.next_after !== null && <button onClick={() => setHistoryAfter(history.next_after)}>More history</button>}</section>}
  </section>;
}
