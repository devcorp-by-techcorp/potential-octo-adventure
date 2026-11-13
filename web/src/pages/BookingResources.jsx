import { useEffect, useRef, useState } from "react";
import { studioApi } from "@/lib/studio-api";

const path = "/studio/booking-resources";
const kinds = { photographer: "Photographer", assistant: "Second photographer / assistant", studio_room: "Studio room / space", equipment: "Specialist equipment" };

export default function BookingResources({ session, onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [edit, setEdit] = useState(null);
  const pending = useRef(null);
  const form = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    studioApi(path, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setItems(data.items); setCursor(data.next_cursor);
    }).catch((failure) => {
      if (controller.signal.aborted) return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, onUnauthorized]);

  function failed(failure) {
    if (failure.status === 401 || failure.status === 403) onUnauthorized();
    else setError(failure.message);
  }

  async function more() {
    setLoading(true); setError("");
    try {
      const data = await studioApi(`${path}?after=${encodeURIComponent(cursor)}`);
      setItems((existing) => [...existing, ...data.items.filter((item) => !existing.some((old) => old.id === item.id))]);
      setCursor(data.next_cursor);
    } catch (failure) { failed(failure); } finally { setLoading(false); }
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setStatus("");
    const values = new FormData(event.currentTarget);
    const fields = { name: values.get("name").trim(), capacity: Number(values.get("capacity")) };
    if (!edit) pending.current ||= { id: crypto.randomUUID(), kind: values.get("kind"), ...fields };
    try {
      const saved = await studioApi(edit ? `${path}/${edit.id}` : path, {
        method: edit ? "PATCH" : "POST", csrf: session.csrf_token,
        body: edit ? { expected_revision: edit.revision, ...fields, enabled: values.get("enabled") === "on" } : pending.current,
      });
      pending.current = null; setEdit(null); form.current.reset();
      setStatus(`Resource saved: ${saved.name}.`); setRefresh((value) => value + 1);
    } catch (failure) {
      if (!edit && (failure.status === 422 || failure.status === 409)) pending.current = null;
      failed(failure);
    } finally { setBusy(false); }
  }

  function choose(item) {
    setEdit(item); setError(""); setStatus("");
  }

  return <section className="studio-inbox" aria-label="Booking resource configuration">
    <h2>Booking resources</h2>
    <p>Configure only real photographers, assistants, rooms and equipment. Configuration does not reserve availability or confirm a booking.</p>
    <p>Capacity describes this resource. Scheduling, travel, holds and confirmation checks are still unavailable.</p>
    {error && <p className="form-error" role="alert">{error} {edit ? "Refresh resources and select the latest version before retrying an uncertain edit." : pending.current ? "Retry the same creation to check its committed result." : ""}</p>}
    {status && <p role="status">{status}</p>}
    <button className="studio-button secondary" disabled={loading || busy} onClick={() => { setError(""); setRefresh((value) => value + 1); }}>Refresh resources</button>
    {loading && <p role="status">Loading resources…</p>}
    {!loading && !items.length && <p>No resources configured.</p>}
    <ul className="inbox-list">{items.map((item) => <li key={item.id}>
      <strong style={{ overflowWrap: "anywhere" }}>{item.name}</strong>
      <p>{kinds[item.kind]} · Capacity {item.capacity} · {item.enabled ? "Enabled" : "Disabled"} · Revision {item.revision}</p>
      <button className="studio-button secondary" disabled={busy || !!pending.current} onClick={() => choose(item)}>Edit {item.name}</button>
    </li>)}</ul>
    {cursor && <button className="studio-button secondary" disabled={loading || busy} onClick={more}>Load more resources</button>}
    <form key={edit ? `${edit.id}:${edit.revision}` : "create"} ref={form} onSubmit={save} aria-label={edit ? "Edit resource" : "Create resource"}>
      <h3>{edit ? "Edit resource" : "Add resource"}</h3>
      {!edit && <label>Resource type<select name="kind" aria-label="Resource type" disabled={busy || !!pending.current} defaultValue="photographer">{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label>Resource name<input name="name" aria-label="Resource name" maxLength={120} required defaultValue={edit?.name || ""} readOnly={busy || !!pending.current} /></label>
      <label>Resource capacity<input name="capacity" aria-label="Resource capacity" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required defaultValue={edit?.capacity || 1} readOnly={busy || !!pending.current} /></label>
      {edit && <label><input type="checkbox" name="enabled" defaultChecked={edit.enabled} disabled={busy} /> Resource enabled</label>}
      <button className="studio-button" disabled={busy} type="submit">{busy ? "Saving resource…" : edit ? "Save resource changes" : pending.current ? "Retry same creation" : "Create resource"}</button>
      {edit && <button className="studio-button secondary" disabled={busy} type="button" onClick={() => setEdit(null)}>Cancel resource edit</button>}
    </form>
  </section>;
}
