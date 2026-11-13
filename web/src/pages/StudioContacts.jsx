import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { studioApi } from "@/lib/studio-api";

export default function StudioContacts({ onUnauthorized }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("client") || "";
  const [cursor, setCursor] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loadedForView = selected
    ? data?.identity?.id === selected
    : Array.isArray(data?.items);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError("");
    studioApi(`/studio/contacts${selected ? `/${selected}` : ""}${cursor ? `?after=${cursor}` : ""}`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setData(result);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
    });
    return () => controller.abort();
  }, [selected, cursor, attempt, onUnauthorized]);
  return <section className="studio-inbox"><h2>Client contacts</h2>
    <p>Canonical client identities and explicit enquiry relationships. Email matching does not grant access. This roster does not create duplicate identities.</p>
    <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh contacts</button>
    {error && <p role="alert">{error}</p>}
    {!loadedForView ? <p role="status">{selected ? "Loading contact…" : "Loading contacts…"}</p> : selected ? <>
      <p>{data.identity.name} · {data.identity.email} · {data.identity.enabled ? "Enabled" : "Disabled"}</p>
      <ul className="inbox-list">{data.relationships.map((item) => <li key={item.grant_id}>{item.enquiry ? <Link to={`/studio/enquiries/${item.enquiry.id}`}>{item.enquiry.reference}</Link> : "Enquiry unavailable"} · {item.access_active ? "Active access" : "Access unavailable"}</li>)}</ul>
      <button className="studio-button secondary" onClick={() => { setParams({}); setCursor(""); }}>Back to contacts</button>
    </> : <><p role="status">{data.items.length} client contacts on this page.</p><ul className="inbox-list">{data.items.map((item) => <li key={item.id}><button className="studio-button secondary" onClick={() => { setParams({ client: item.id }); setCursor(""); }}>{item.name} · {item.email}</button></li>)}</ul></>}
    {data && <nav aria-label="Contact pages">{cursor && <button onClick={() => setCursor("")}>First page</button>}{data.next_cursor && <button onClick={() => setCursor(data.next_cursor)}>Next page</button>}</nav>}
  </section>;
}
