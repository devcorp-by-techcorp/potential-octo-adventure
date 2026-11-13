import { useEffect, useState } from "react";
import { studioApi } from "@/lib/studio-api";

const metrics = [
  ["enquiries", "All enquiries", "Every saved enquiry, including archived records."],
  ["new_enquiries", "New enquiries", "New triage status, including records without a saved status."],
  ["in_review_enquiries", "In review", "Enquiries with the internal in-review triage status."],
  ["archived_enquiries", "Archived enquiries", "Archived triage records; archiving does not delete them."],
  ["unclassified_enquiries", "Unclassified enquiries", "Records with an unsupported status that need operator review."],
  ["enabled_clients", "Enabled clients", "Enabled client identities, whether or not they currently have access."],
  ["active_access_grants", "Active enquiry access", "Unrevoked enquiry grants for enabled clients and existing enquiries."],
];

export default function StudioReporting({ onUnauthorized }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setReport(null); setError("");
    studioApi("/studio/reporting", { signal: controller.signal }).then((result) => {
      if (active) setReport(result);
    }).catch((failure) => {
      if (!active || failure.name === "AbortError") return;
      if (failure.status === 401 || failure.status === 403) onUnauthorized();
      else setError(failure.message);
    });
    return () => { active = false; controller.abort(); };
  }, [attempt, onUnauthorized]);
  return <section className="studio-inbox">
    <h2>Studio reporting</h2>
    <p>Operational counts from saved records. Enquiry triage and client access do not confirm bookings or record payments.</p>
    <button className="studio-button secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh counts</button>
    {error ? <p role="alert" className="form-error">{error}</p> : !report
      ? <p role="status">Loading studio counts…</p> : <>
        <p role="status">Observed {new Intl.DateTimeFormat("en-AU", {
          dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
        }).format(new Date(report.observed_at))} UTC. Counts may change during concurrent updates.</p>
        <dl className="enquiry-details">{metrics.map(([field, label, definition]) => <div key={field}>
          <dt>{label}</dt><dd><strong>{report[field]}</strong> — {definition}</dd>
        </div>)}</dl>
      </>}
  </section>;
}
