import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { studioApi } from "@/lib/studio-api";

export default function EnquiryOperations({ session, onUnauthorized }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState("25");
  const [filter, setFilter] = useState({ query: "", status: "", limit: "25", offset: 0 });
  const [page, setPage] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [triage, setTriage] = useState("in_review");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const action = useRef(null);
  const parameters = new URLSearchParams({ limit: filter.limit, offset: String(filter.offset) });
  if (filter.query) parameters.set("query", filter.query);
  if (filter.status) parameters.set("status", filter.status);
  const suffix = parameters.toString();

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; action.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPage(null); setSelection(new Set()); setError("");
    studioApi(`/studio/operations/enquiries?${suffix}`, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setPage(data);
    }).catch((failure) => {
      if (controller.signal.aborted || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => controller.abort();
  }, [suffix, attempt, onUnauthorized]);

  function search(event) {
    event.preventDefault(); setResults([]); setNotice("");
    setFilter({ query: query.trim(), status, limit, offset: 0 });
    setAttempt((value) => value + 1);
  }
  function toggle(id) {
    setSelection((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 50) next.add(id);
      return next;
    });
  }
  async function applyTriage() {
    const targets = page.items.filter((item) => selection.has(item.id));
    if (!targets.length) return;
    action.current = new AbortController();
    setBusy(true); setError(""); setNotice(""); setResults([]);
    try {
      const data = await studioApi("/studio/operations/bulk-triage", {
        signal: action.current.signal, csrf: session.csrf_token,
        body: { studio_status: triage, items: targets.map((item) => ({
          id: item.id, expected_revision: item.studio_revision,
        })) },
      });
      if (!alive.current) return;
      if (data.authorization_lost) { onUnauthorized(); return; }
      setResults(data.results.map((result) => ({ ...result,
        reference: targets.find((target) => target.id === result.id)?.reference || result.id,
      })));
      setNotice("Bulk triage finished. Review each result; conflicts require a fresh version.");
      setSelection(new Set()); setAttempt((value) => value + 1);
    } catch (failure) {
      if (!alive.current || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else {
        setError(`${failure.message} Some records may have changed. Refresh the list before retrying.`);
        setSelection(new Set());
      }
    } finally { if (alive.current) setBusy(false); }
  }
  async function download() {
    action.current = new AbortController(); setBusy(true); setError(""); setNotice("");
    try {
      const data = await studioApi(`/studio/operations/export?${suffix}`, { signal: action.current.signal });
      if (!alive.current) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `studio-enquiries-page-${filter.offset}.json`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setNotice(`Downloaded ${data.items.length} enquiry summaries from this page.`);
    } catch (failure) {
      if (!alive.current || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    } finally { if (alive.current) setBusy(false); }
  }

  return <section className="studio-inbox" aria-labelledby="operations-heading">
    <h2 id="operations-heading">Enquiry operations</h2>
    <p>Search saved enquiries, download limited summaries, or update triage. These actions do not confirm bookings or delete records.</p>
    <form onSubmit={search} className="studio-signin">
      <label htmlFor="operations-search">Search words</label>
      <input id="operations-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={200} disabled={busy} />
      <p>Search reference, name, event type, venue and customer message. Words match whole tokens; quote a phrase or prefix a word with a minus to exclude it. Internal notes are excluded.</p>
      <label htmlFor="operations-status">Triage filter</label>
      <select id="operations-status" value={status} onChange={(event) => setStatus(event.target.value)} disabled={busy}>
        <option value="">All statuses</option><option value="new">New</option><option value="in_review">In review</option><option value="archived">Archived</option>
      </select>
      <label htmlFor="operations-limit">Results per page</label>
      <select id="operations-limit" value={limit} onChange={(event) => setLimit(event.target.value)} disabled={busy}>
        <option value="25">25</option><option value="50">50</option><option value="100">100</option>
      </select>
      <button className="studio-button primary" disabled={busy}>Search enquiries</button>
    </form>
    <button className="studio-button secondary" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>Refresh list</button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {results.length > 0 && <ul aria-label="Bulk triage results">{results.map((result) => <li key={result.id}>{result.reference}: {result.outcome.replaceAll("_", " ")}</li>)}</ul>}
    {!page ? <p>Loading enquiry summaries…</p> : <>
      <p>{page.items.length} enquiries on this page. Select up to 50 records; each save checks its displayed revision.</p>
      <button className="studio-button secondary" disabled={busy || !page.items.length} onClick={download}>Download this page as JSON</button>
      <p>Downloads contain reference, name, event type, requested date, collection, creation time, triage status, revision and record ID. Contact details, messages and internal notes are excluded.</p>
      <ul className="inbox-list">{page.items.map((item) => <li key={item.id}>
        <label><input type="checkbox" checked={selection.has(item.id)} disabled={busy || (!selection.has(item.id) && selection.size >= 50)} onChange={() => toggle(item.id)} /> Select {item.reference}</label>
        <Link className="enquiry-link" to={`/studio/enquiries/${item.id}`}>{item.reference} · {item.name} · {item.event_type}</Link>
        <p>{item.studio_status} · revision {item.studio_revision}</p>
      </li>)}</ul>
      {page.window_exhausted && <p>Search window reached. Narrow the search to retrieve additional records.</p>}
      <div className="inbox-actions">
        <button className="studio-button secondary" disabled={busy || filter.offset === 0} onClick={() => setFilter((value) => ({ ...value, offset: Math.max(0, value.offset - Number(value.limit)) }))}>Previous results</button>
        <button className="studio-button secondary" disabled={busy || page.next_offset === null} onClick={() => setFilter((value) => ({ ...value, offset: page.next_offset }))}>Next results</button>
      </div>
      <label htmlFor="bulk-triage">Selected enquiries triage status</label>
      <select id="bulk-triage" value={triage} disabled={busy} onChange={(event) => setTriage(event.target.value)}>
        <option value="new">New</option><option value="in_review">In review</option><option value="archived">Archived</option>
      </select>
      <button className="studio-button primary" disabled={busy || !selection.size} onClick={applyTriage}>Apply triage to {selection.size} selected</button>
    </>}
  </section>;
}
