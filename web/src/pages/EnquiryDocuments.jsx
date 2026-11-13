import { useCallback, useEffect, useRef, useState } from "react";
import { privateApi } from "@/lib/studio-api";

const baseUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
async function transfer(path, { file, csrf, signal } = {}) {
  let response;
  try {
    const form = file ? new FormData() : null;
    if (form) form.append("file", file);
    response = await fetch(`${baseUrl}/api${path}`, {
      credentials: "include", method: file ? "POST" : "GET",
      ...(form ? { body: form, headers: { "X-CSRF-Token": csrf } } : {}),
      signal: signal || AbortSignal.timeout(60000),
    });
  } catch { throw new Error("Private document transfer was interrupted. Check status or retry the same upload."); }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const problem = new Error(typeof data?.detail === "string" ? data.detail : "Private document transfer failed.");
    problem.status = response.status; throw problem;
  }
  return file ? response.json() : response.blob();
}

export default function EnquiryDocuments({ enquiryId, session, scope = "studio", onUnauthorized }) {
  const [participants, setParticipants] = useState([]);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const pending = useRef(null);
  const input = useRef(null);
  const path = scope === "client" ? `/client/enquiries/${enquiryId}/documents`
    : clientId ? `/studio/enquiries/${enquiryId}/documents/${clientId}` : "";
  const livePath = useRef(path); livePath.current = path;
  const failure = useCallback((problem) => {
    if (problem.status === 401 || problem.status === 403) onUnauthorized();
    else { setError(problem.message); if (problem.status === 404) { setItems([]); setPage(null); } }
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
  useEffect(() => {
    setTitle(""); setDocumentId(""); setFile(null); setBusy(false); setRetry(false); setNotice("");
    pending.current = null;
    if (input.current) input.current.value = "";
  }, [path]);
  useEffect(() => {
    setItems([]); setPage(null); setError("");
    if (!path) return;
    const controller = new AbortController();
    privateApi(path, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setItems(data.items); setPage(data); }
    }).catch((problem) => { if (!controller.signal.aborted) failure(problem); });
    return () => controller.abort();
  }, [path, refresh, failure]);

  async function upload(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (!pending.current) {
        if (!file || !title.trim()) throw new Error("Choose a file and document title.");
        if (file.size > page.upload_max_bytes) throw new Error("Document exceeds the configured upload limit.");
        const bytes = await file.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        if (livePath.current !== path) return;
        pending.current = { id: crypto.randomUUID(), document_id: documentId || crypto.randomUUID(),
          title: title.trim(), filename: file.name, content_type: file.type, size: file.size,
          sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("") };
      }
      const initiated = await privateApi(`${path}/uploads`, { body: pending.current, csrf: session.csrf_token });
      if (initiated.status !== "ready") await transfer(`${path}/${pending.current.id}/content`, { file, csrf: session.csrf_token });
      if (livePath.current !== path) return;
      pending.current = null; setRetry(false); setFile(null); setTitle("");
      if (input.current) input.current.value = "";
      setNotice("Private document saved. Publish this version separately to give the client access.");
      setRefresh((value) => value + 1);
    } catch (problem) {
      if (livePath.current === path) { setRetry(!!pending.current); failure(problem); }
    } finally { if (livePath.current === path) setBusy(false); }
  }
  async function publish(item) {
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await privateApi(`${path}/${item.id}/publish`, { body: { published: !item.published, expected_revision: item.revision }, csrf: session.csrf_token });
      if (livePath.current !== path) return;
      setItems((existing) => existing.map((version) => version.id === item.id ? updated : version));
      setNotice(updated.published ? "This document version is available to the granted client." : "This document version is private to the studio.");
    } catch (problem) { if (livePath.current === path) failure(problem); }
    finally { if (livePath.current === path) setBusy(false); }
  }
  async function download(item) {
    setBusy(true); setError("");
    try {
      const blob = await transfer(`${path}/${item.id}/download`);
      if (livePath.current !== path) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = item.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) { if (livePath.current === path) failure(problem); }
    finally { if (livePath.current === path) setBusy(false); }
  }
  async function more() {
    setBusy(true); setError("");
    try {
      const data = await privateApi(`${path}?after=${page.next_cursor}`);
      if (livePath.current !== path) return;
      setItems((existing) => [...existing, ...data.items]); setPage(data);
    } catch (problem) { if (livePath.current === path) failure(problem); }
    finally { if (livePath.current === path) setBusy(false); }
  }
  const uniqueDocuments = Array.from(new Map(items.map((item) => [item.document_id, item])).values());
  return <section className="studio-inbox" aria-label="Private enquiry documents">
    <h3>Private documents</h3>
    <p>{scope === "studio" ? "Publish each version separately to share it with this client. Electronic signing is unavailable." : "Download document versions the studio has shared with you."}</p>
    <button className="studio-button secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh documents</button>
    {scope === "studio" && <label>Document client<select aria-label="Document client" disabled={busy} value={clientId} onChange={(event) => setClientId(event.target.value)}>
      {participants.map((grant) => <option key={grant.id} value={grant.client_id}>{grant.name} ({grant.email})</option>)}
    </select></label>}
    {scope === "studio" && !participants.length && <p>No active client access. An accepted invitation is required to associate documents.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {page && <>
      {scope === "studio" && <form className="inbox-editor" onSubmit={upload}>
        <p>PDF, PNG or JPEG only. Maximum {Math.round(page.upload_max_bytes / 1024 / 1024)} MiB. Uploads start private.</p>
        <label>Document title<input aria-label="Document title" required maxLength={160} disabled={busy || retry} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Version of<select aria-label="Document version target" disabled={busy || retry} value={documentId} onChange={(event) => setDocumentId(event.target.value)}>
          <option value="">New document</option>{uniqueDocuments.map((item) => <option key={item.document_id} value={item.document_id}>{item.title}</option>)}
        </select></label>
        <label>Document file<input ref={input} aria-label="Document file" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy || retry} required={!retry} onChange={(event) => setFile(event.target.files[0] || null)} /></label>
        <button className="studio-button" disabled={busy || !file || !title.trim()}>{busy ? "Uploading…" : retry ? "Retry same document upload" : "Upload private document"}</button>
        {retry && <button type="button" className="studio-button secondary" disabled={busy} onClick={() => { if (pending.current) setDocumentId(pending.current.document_id); pending.current = null; setRetry(false); setError(""); }}>Start a new upload version</button>}
      </form>}
      <ul className="inbox-list">{items.map((item) => <li key={item.id} style={{ overflowWrap: "anywhere" }}>
        <h4>{item.title} · version {item.version}</h4>
        <p>{item.filename} · {item.size} bytes · {new Date(item.created_at).toLocaleString()}</p>
        {scope === "studio" && <p>{item.status} · {item.published ? "Published to client" : "Studio only"}</p>}
        {(scope === "client" || item.status === "ready") && <button className="studio-button secondary" disabled={busy} onClick={() => download(item)}>Download {item.filename} v{item.version}</button>}
        {scope === "studio" && item.status === "ready" && <button className="studio-button secondary" disabled={busy} onClick={() => publish(item)}>{item.published ? "Unpublish" : "Publish"} {item.title} v{item.version}</button>}
        {scope === "studio" && <details><summary>Version activity</summary><ul>{item.history?.map((event, index) => <li key={index}>{{ upload_initiated: "Upload started", upload_completed: "Upload completed", upload_failed: "Upload failed", published: "Published to client", unpublished: "Made private to studio" }[event.action] || event.action} · {new Date(event.at).toLocaleString()}</li>)}</ul></details>}
      </li>)}</ul>
      {!items.length && <p>No available document versions.</p>}
      {page.next_cursor && <button className="studio-button secondary" disabled={busy} onClick={more}>Load more document versions</button>}
    </>}
  </section>;
}
