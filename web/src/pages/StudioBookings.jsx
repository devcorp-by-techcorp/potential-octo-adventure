import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studioApi } from "@/lib/studio-api";

const labels = { planning: "Planning", confirmed: "Confirmed", preparation: "Preparation", shoot: "Shoot",
  gallery_preparation: "Selected-gallery preparation", delivered: "Delivered", cancelled: "Cancelled" };
const next = { planning: "confirmed", confirmed: "preparation", preparation: "shoot",
  shoot: "gallery_preparation", gallery_preparation: "delivered", cancelled: "planning" };

export default function StudioBookings({ session, onUnauthorized }) {
  const { bookingId } = useParams();
  return bookingId ? <Detail key={bookingId} id={bookingId} session={session} onUnauthorized={onUnauthorized} />
    : <List onUnauthorized={onUnauthorized} />;
}

function List({ onUnauthorized }) {
  const [items, setItems] = useState(null); const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef(null);
  useEffect(() => { const controller = new AbortController();
    setItems(null); setError("");
    studioApi("/studio/bookings", { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setItems(data.items); heading.current?.focus(); }
    })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
      });
    return () => controller.abort(); }, [onUnauthorized, attempt]);
  return <section className="studio-inbox"><h2 ref={heading} tabIndex={-1}>Bookings and shoot tracker</h2>
    <p>Stored operational records. Planning records do not reserve dates. Confirmation is unavailable until resource capacity, scheduling, approval, contract and payment checks are implemented.</p>
    {error ? <><p role="alert" className="form-error">{error}</p>
      <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button></> : !items ? <p role="status">Loading bookings…</p>
      : items.length === 0 ? <p role="status">No planning bookings yet. Create one from an enquiry.</p>
      : <ul className="inbox-list">{items.map((item) => <li key={item.id}><Link className="enquiry-link" to={`/studio/bookings/${item.id}`}>
        <strong>{item.reference}</strong><span>{item.client_name} · {item.event_type}</span>
        <span>{item.scheduled_date.split("-").reverse().join("/")} · {labels[item.state]}</span>
      </Link></li>)}</ul>}</section>;
}

function Detail({ id, session, onUnauthorized }) {
  const [data, setData] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0); const [missing, setMissing] = useState(false);
  const [latest, setLatest] = useState(null); const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState("");
  const [draft, setDraft] = useState({ scheduled_date: "", location: "", staff_note: "" });
  const request = useRef(null); const active = useRef(false);
  const heading = useRef(null); const note = useRef(null);
  const path = `/studio/bookings/${encodeURIComponent(id)}`;
  const dirty = data && Object.keys(draft).some((key) => draft[key] !== data[key]);
  function applySaved(saved) {
    setData(saved);
    setDraft({ scheduled_date: saved.scheduled_date, location: saved.location, staff_note: saved.staff_note });
  }
  useEffect(() => {
    active.current = true;
    const controller = new AbortController(); request.current = controller;
    setError(""); setMissing(false);
    studioApi(path, { signal: controller.signal }).then((saved) => {
      if (controller.signal.aborted) return;
      applySaved(saved); heading.current?.focus();
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else if (failure.status === 404) setMissing(true);
      else if (failure.status === 422) setError("This booking link is invalid. Return to the booking list.");
      else setError(failure.message);
    });
    return () => { active.current = false; request.current?.abort(); };
  }, [path, attempt, onUnauthorized]);
  async function perform(operation, state) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setSuccess("");
    try {
      const saved = await studioApi(path, { signal: controller.signal,
        ...(operation === "review" ? {} : { method: "PATCH", csrf: session.csrf_token,
          body: { expected_revision: data.revision, ...(operation === "save" ? draft : { state }) } }),
      });
      if (!active.current || controller.signal.aborted) return;
      if (operation === "review") { setLatest(saved); setConflict(true); }
      else {
        applySaved(saved); setConflict(false); setLatest(null);
        setSuccess(operation === "save" ? "Booking details saved." : `Booking moved to ${labels[saved.state]}.`);
      }
    } catch (failure) {
      if (!active.current || controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else {
        setError(failure.status === 422 ? "Check the booking details. Use a valid calendar date and stay within the field limits." : failure.message);
        if (failure.status === 409) { setConflict(true); setLatest(null); }
      }
    } finally { if (active.current && !controller.signal.aborted) setBusy(false); }
  }
  function reconcile(keepDraft) {
    if (keepDraft) setData(latest); else applySaved(latest);
    setLatest(null); setConflict(false); setError(""); setSuccess(""); note.current?.focus();
  }
  function edit(field, value) { setDraft({ ...draft, [field]: value }); setSuccess(""); }
  return <section className="studio-inbox"><Link className="studio-button secondary" to="/studio/bookings">Back to bookings</Link>
    <h2 ref={heading} tabIndex={-1}>{data?.reference || "Booking details"}</h2>{error && <p role="alert" className="form-error">{error}</p>}
    {missing ? <p role="status">Booking not found.</p> : !data ? error
      ? <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      : <p role="status">Loading booking…</p> : <><dl className="enquiry-details">
      <div><dt>Client</dt><dd>{data.client_name}</dd></div><div><dt>Stage</dt><dd>{labels[data.state]}</dd></div>
      <div><dt>Planned date</dt><dd>{data.scheduled_date}</dd></div><div><dt>Location</dt><dd>{data.location || "Not set"}</dd></div>
      <div><dt>Revision</dt><dd className="numeric">{data.revision}</dd></div></dl>
      <p>A planning booking does not reserve a date. Confirmation is unavailable until resource capacity, scheduling, approval, contract and payment checks are implemented.</p>
      {dirty && <p role="status">Save or discard your detail changes before changing the booking stage.</p>}
      <div className="inbox-actions">{next[data.state] && <button className="studio-button primary" disabled={busy || conflict || dirty || data.state === "planning"}
        onClick={() => perform("transition", next[data.state])}>{data.state === "planning" ? "Confirmation unavailable" : data.state === "cancelled" ? "Reopen to planning" : `Move to ${labels[next[data.state]]}`}</button>}
        {!['cancelled','delivered'].includes(data.state) && <button className="studio-button secondary" disabled={busy || conflict || dirty} onClick={() => perform("transition", "cancelled")}>Cancel booking</button>}</div>
      <form className="inbox-editor" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); perform("save"); }}><label htmlFor="booking-date">Planned date</label>
        <input id="booking-date" type="date" value={draft.scheduled_date} disabled={busy} onChange={(event) => edit("scheduled_date", event.target.value)} required />
        <label htmlFor="booking-location">Location</label><input id="booking-location" value={draft.location} disabled={busy} maxLength={300} onChange={(event) => edit("location", event.target.value)} />
        <label htmlFor="booking-note">Private staff note</label><textarea ref={note} id="booking-note" value={draft.staff_note} disabled={busy} maxLength={2000} rows={5} onChange={(event) => edit("staff_note", event.target.value)} />
        <div className="inbox-actions">
          <button className="studio-button primary" disabled={busy || conflict || !dirty} type="submit">Save booking details</button>
          <button className="studio-button secondary" disabled={busy} type="button" onClick={() => perform("review")}>Review latest saved version</button>
          {dirty && !conflict && <button className="studio-button secondary" disabled={busy} type="button" onClick={() => { applySaved(data); setSuccess(""); }}>Discard detail changes</button>}
        </div></form>
      {success && <p role="status">{success}</p>}
      {conflict && <aside className="inbox-reconcile" aria-label="Reconcile booking changes">
        <p role="status">Your draft is retained. Review the saved version before choosing how to continue.</p>
        {latest && <><h3>Latest saved booking</h3><dl className="enquiry-details">
          {[["Revision", latest.revision], ["Stage", labels[latest.state]], ["Planned date", latest.scheduled_date],
            ["Location", latest.location || "Not set"], ["Private staff note", latest.staff_note || "No note"]]
            .map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl><div className="inbox-actions">
          <button className="studio-button secondary" disabled={busy} onClick={() => reconcile(true)}>Keep my draft against this revision</button>
          <button className="studio-button secondary" disabled={busy} onClick={() => reconcile(false)}>Use saved booking details</button>
        </div></>}
      </aside>}
      <h3>History</h3><ol>{data.history.map((event, index) => <li key={`${event.at}-${index}`}>{event.from ? `${labels[event.from]} → ` : "Created as "}{labels[event.to]} · {new Date(event.at).toLocaleString("en-AU")}</li>)}</ol>
    </>}</section>;
}
