import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { studioApi } from "@/lib/studio-api";
import { BookingPreparation } from "@/pages/BookingDrafts";
import EnquiryDocuments from "@/pages/EnquiryDocuments";
import EnquiryConversation from "@/pages/EnquiryConversation";
import StudioInvitations from "@/pages/StudioInvitations";
import StudioClientAccess from "@/pages/StudioClientAccess";

const statuses = [["new", "New"], ["in_review", "In review"], ["archived", "Archived"]];
const timestamp = (value) => value ? new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
}).format(new Date(value)) + " UTC" : "No staff updates yet";
// A preferred date is a calendar date, never converted through a timezone.
const calendarDate = (value) => value.split("-").reverse().join("/");

export default function StudioEnquiries({ session, onUnauthorized }) {
  const { enquiryId } = useParams();
  return enquiryId
    ? <EnquiryDetail key={enquiryId} id={enquiryId} session={session} onUnauthorized={onUnauthorized} />
    : <EnquiryList onUnauthorized={onUnauthorized} />;
}

function EnquiryList({ onUnauthorized }) {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef(null);
  const status = params.get("status") || "";
  const cursor = params.get("cursor") || "";
  const limit = params.get("limit") || "25";
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setResult(null);
    setError("");
    const query = new URLSearchParams({ limit, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) });
    studioApi(`/studio/enquiries?${query}`, { signal: controller.signal }).then((data) => {
      if (active) { setResult(data); heading.current?.focus(); }
    }).catch((failure) => {
      if (!active || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => { active = false; controller.abort(); };
  }, [status, cursor, limit, attempt, onUnauthorized]);
  function filter(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setParams({ ...(values.get("status") ? { status: values.get("status") } : {}), limit: values.get("limit") });
  }
  return <section className="studio-inbox">
    <h2 ref={heading} tabIndex={-1}>Enquiry inbox</h2>
    <p>Internal triage only. All enquiries await studio confirmation.</p>
    <form className="inbox-filter" onSubmit={filter} key={`${status}:${limit}`}>
      <label htmlFor="inbox-status">Filter by status</label>
      <select id="inbox-status" name="status" defaultValue={status}>
        <option value="">All statuses</option>
        {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="inbox-limit">Enquiries per page</label>
      <select id="inbox-limit" name="limit" defaultValue={limit}>
        {[1, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      <button className="studio-button secondary" type="submit">Apply filter</button>
    </form>
    {error ? <><p role="alert" className="form-error">{error}</p>
      <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      <button className="studio-button secondary" onClick={() => setParams({})}>Reset filters</button>
    </> : !result ? <p role="status">Loading enquiries…</p> : <>
      <p role="status">{result.items.length ? `${result.items.length} enquiries on this page.`
        : status ? "No enquiries match this filter." : "No enquiries yet."}</p>
      <ul className="inbox-list">{result.items.map((item) => <li key={item.id}>
        <Link to={`/studio/enquiries/${item.id}`} className="enquiry-link">
          <strong>{item.reference}</strong><span>{item.name}</span>
          <span>{item.event_type} · {calendarDate(item.preferred_date)} · {item.collection}</span>
          <span>{statuses.find(([value]) => value === item.studio_status)?.[1]} · {timestamp(item.created_at)}</span>
        </Link>
      </li>)}</ul>
      <nav aria-label="Inbox pages" className="inbox-actions">
        {cursor && <button className="studio-button secondary" onClick={() => setParams({ ...(status ? { status } : {}), limit })}>First page</button>}
        {result.next_cursor && <button className="studio-button primary" onClick={() => setParams({ ...(status ? { status } : {}), limit, cursor: result.next_cursor })}>Next page</button>}
      </nav>
    </>}
  </section>;
}

function EnquiryDetail({ id, session, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [latest, setLatest] = useState(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("new");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [booking, setBooking] = useState(null);
  const [accessRevision, setAccessRevision] = useState(0);
  const heading = useRef(null);
  const request = useRef(null);
  const active = useRef(true);
  const path = `/studio/enquiries/${encodeURIComponent(id)}`;
  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    request.current = controller;
    setError("");
    studioApi(path, { signal: controller.signal }).then((saved) => {
      if (!active.current || controller.signal.aborted) return;
      setData(saved); setNote(saved.studio_note); setStatus(saved.studio_status);
      heading.current?.focus();
    }).catch((failure) => {
      if (!active.current || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else if (failure.status === 404) setMissing(true);
      else setError(failure.message);
    });
    return () => { active.current = false; request.current?.abort(); };
  }, [path, attempt, onUnauthorized]);

  async function perform(operation) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setSuccess("");
    try {
      const saved = await studioApi(path, {
        signal: controller.signal,
        ...(operation === "save" ? { method: "PATCH", csrf: session.csrf_token,
          body: { expected_revision: data.studio_revision, studio_status: status, studio_note: note } } : {}),
      });
      if (!active.current || controller.signal.aborted) return;
      if (operation === "save") {
        setData(saved); setLatest(null); setConflict(false);
        setNote(saved.studio_note); setStatus(saved.studio_status);
        setSuccess("Changes saved.");
      } else {
        setLatest(saved);
        setConflict(true);
      }
    } catch (failure) {
      if (!active.current || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else {
        setError(failure.message);
        if (failure.status === 409) { setConflict(true); setLatest(null); }
      }
    } finally {
      if (active.current && !controller.signal.aborted) setBusy(false);
    }
  }
  async function createBooking() {
    setBusy(true); setError("");
    try { setBooking(await studioApi(`${path}/booking`, { body: {}, csrf: session.csrf_token })); }
    catch (failure) { if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message); }
    finally { setBusy(false); }
  }
  function reconcile(keepDraft) {
    setData(latest);
    if (!keepDraft) { setNote(latest.studio_note); setStatus(latest.studio_status); }
    setLatest(null); setConflict(false); setError(""); setSuccess("");
    document.getElementById("studio-note")?.focus();
  }
  return <section className="studio-inbox">
    <Link className="studio-button secondary" to="/studio/enquiries">Back to inbox</Link>
    <h2 ref={heading} tabIndex={-1}>{data ? data.reference : "Enquiry details"}</h2>
    {error && <p role="alert" className="form-error">{error}</p>}
    {missing ? <p role="status">Enquiry not found.</p> : !data ? error
      ? <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      : <p role="status">Loading enquiry…</p> : <>
      <p>Awaiting studio confirmation. Triage does not confirm a booking, reserve a date or send a reply.</p>
      <dl className="enquiry-details">
        {[["Name", data.name], ["Email", data.email], ["Phone", data.phone || "Not supplied"],
          ["Event type", data.event_type], ["Preferred date", calendarDate(data.preferred_date)],
          ["Collection", data.collection], ["Venue", data.venue || "Not supplied"],
          ["Customer message", data.message || "Not supplied"], ["Consent", data.consent ? "Given" : "Not given"],
          ["Received", timestamp(data.created_at)], ["Last studio update", timestamp(data.studio_updated_at)],
          ["Updated by staff ID", data.studio_updated_by || "No staff updates yet"],
          ["Revision", String(data.studio_revision)]].map(([label, value]) => <div key={label}>
          <dt>{label}</dt><dd>{value}</dd>
        </div>)}
      </dl>
      <div className="inbox-actions"><button className="studio-button primary" type="button" disabled={busy} onClick={createBooking}>Create planning booking</button>
        {booking && <Link className="studio-button secondary" to={`/studio/bookings/${booking.id}`}>Open {booking.reference} booking</Link>}</div>
      <EnquiryDocuments enquiryId={id} session={session} scope="studio" onUnauthorized={onUnauthorized} />
      <EnquiryConversation enquiryId={id} session={session} scope="studio" onUnauthorized={onUnauthorized} />
      <BookingPreparation enquiryId={id} session={session} onUnauthorized={onUnauthorized} />
      <StudioClientAccess id={id} session={session} onUnauthorized={onUnauthorized} onRevoked={() => setAccessRevision((value) => value + 1)} />
      <StudioInvitations key={accessRevision} id={id} email={data.email} session={session} onUnauthorized={onUnauthorized} />
      <form className="inbox-editor" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); perform("save"); }}>
        <label htmlFor="triage-status">Internal status</label>
        <select id="triage-status" value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value); setSuccess(""); }}>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="studio-note">Private studio note</label>
        <textarea id="studio-note" value={note} disabled={busy} maxLength={2000} rows={7}
          aria-describedby="note-help" onChange={(event) => { setNote(event.target.value); setSuccess(""); }} />
        <p id="note-help">Shared with authorized staff only. {note.length}/2,000 characters.</p>
        <div className="inbox-actions">
          <button className="studio-button primary" disabled={busy || conflict} type="submit">{busy ? "Working…" : "Save changes"}</button>
          <button className="studio-button secondary" disabled={busy} type="button" onClick={() => perform("refresh")}>Review latest saved version</button>
        </div>
      </form>
      {success && <p role="status">{success}</p>}
      {conflict && <aside className="inbox-reconcile" aria-label="Reconcile changes">
        <p role="status">Your draft is retained. Review the saved version before choosing how to continue.</p>
        {latest && <>
          <p>Saved revision {latest.studio_revision} · {latest.studio_status} · {timestamp(latest.studio_updated_at)}</p>
          <p className="saved-note">{latest.studio_note || "Saved note is empty."}</p>
          <div className="inbox-actions">
            <button className="studio-button secondary" onClick={() => reconcile(true)}>Keep my draft against this revision</button>
            <button className="studio-button secondary" onClick={() => reconcile(false)}>Use saved status and note</button>
          </div>
        </>}
      </aside>}
    </>}
  </section>;
}
