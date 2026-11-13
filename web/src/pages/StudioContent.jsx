import { useEffect, useState } from "react";
import { studioApi } from "@/lib/studio-api";

const fields = [
  ["hero_description", "Hero description", 1000], ["hero_footnote", "Hero footnote", 200],
  ["philosophy_title", "Philosophy title", 200], ["philosophy_description", "Philosophy description", 1000],
];
export default function StudioContent({ session, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [content, setContent] = useState(null);
  const [history, setHistory] = useState(null);
  const [after, setAfter] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setData(null);
    studioApi("/studio/content", { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) { setData(value); setContent(value.draft); }
    }).catch((failure) => {
      if (!controller.signal.aborted) {
        if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
      }
    });
    return () => controller.abort();
  }, [attempt, onUnauthorized]);
  useEffect(() => {
    const controller = new AbortController(); setHistory(null);
    studioApi(`/studio/content/history?after=${after}`, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setHistory(value);
    }).catch((failure) => {
      if (!controller.signal.aborted) {
        if (failure.status === 401 || failure.status === 403) onUnauthorized(); else setError(failure.message);
      }
    });
    return () => controller.abort();
  }, [after, attempt, onUnauthorized]);
  async function act(action, sourceRevision) {
    const proposed = { expected_revision: data.revision, ...(action === "draft" ? { content } : {}), ...(action === "restore" ? { source_revision: sourceRevision } : {}) };
    const key = `${action}:${JSON.stringify(proposed)}`;
    const command = pending?.key === key ? pending.id : crypto.randomUUID();
    setPending({ key, id: command }); setBusy(true); setError(""); setNotice("");
    try {
      const value = await studioApi(`/studio/content/${action}`, { body: { ...proposed, command_id: command }, csrf: session.csrf_token });
      setData(value); setContent(value.draft); setPending(null);
      setNotice(action === "publish" ? "Saved draft published." : action === "restore" ? "Version restored to draft. Publish separately when ready." : "Draft saved. Public content unchanged.");
      setAfter(-1); setAttempt((count) => count + 1);
    } catch (failure) {
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(`${failure.message} Retry unchanged input after an uncertain response, or reload before editing.`);
    } finally { setBusy(false); }
  }
  const dirty = data && JSON.stringify(content) !== JSON.stringify(data.draft);
  return <section className="studio-inbox"><h2>Website narrative</h2>
    <p>Edit plain text narrative only. Packages, prices, booking terms and media are managed separately. Saving a draft does not publish it.</p>
    <button className="studio-button secondary" disabled={busy} onClick={() => { setPending(null); setAttempt((count) => count + 1); }}>Reload content</button>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!data || !content ? <p>Loading content…</p> : <>
      <p>Draft revision {data.revision}. Published revision {data.published_revision ?? "original source"}.</p>
      <form className="inbox-editor" onSubmit={(event) => { event.preventDefault(); act("draft"); }} aria-busy={busy}>
        {fields.map(([key, label, maximum]) => <label key={key}>{label}<textarea required maxLength={maximum} disabled={busy} value={content[key]} onChange={(event) => setContent({ ...content, [key]: event.target.value })} /></label>)}
        <button className="studio-button primary" disabled={busy}>Save draft</button>
      </form>
      <button className="studio-button secondary" disabled={busy || dirty} onClick={() => act("publish")}>Publish saved draft</button>
      {dirty && <p>Save your edits before publishing.</p>}
      <section><h3>Version history</h3><button className="studio-button secondary" disabled={busy || dirty} onClick={() => act("restore", 0)}>Restore original source to draft</button>{history ? <>
        <ul>{history.items.map((version) => <li key={version.revision}>
          <p>Revision {version.revision} · {version.action} · {new Date(version.at).toISOString()} · Staff {version.actor_id}</p>
          <p>{version.content.hero_description}</p>
          <button className="studio-button secondary" disabled={busy || dirty} onClick={() => act("restore", version.revision)}>Restore revision {version.revision} to draft</button>
        </li>)}</ul>
        {after > -1 && <button onClick={() => setAfter(-1)}>First versions</button>}
        {history.next_after !== null && <button onClick={() => setAfter(history.next_after)}>More versions</button>}
      </> : <p>Loading versions…</p>}</section>
    </>}
  </section>;
}
