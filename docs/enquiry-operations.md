# Staff enquiry operations

`/studio/operations` adds staff-only indexed search, page downloads and bulk triage
to saved enquiries. Scope comes from the authorised development programme's
Phase 10: search, field-level private export and per-record bulk authorisation.
No booking, customer identity matching, deletion or retention policy is introduced.

## Search and downloads

`GET /api/studio/operations/enquiries` and `GET /api/studio/operations/export`
accept `query` (1–200 characters), `status` (`new`, `in_review` or `archived`),
`limit` (1–100, default 25) and `offset` (0–10,000, default zero).
Both return `items`, `next_offset` and `window_exhausted`. Missing/null legacy
triage status displays as new without modifying the original. Unsupported saved
statuses remain visible for staff correction.

A repeatable `studio_enquiry_search` MongoDB text index covers reference, name,
event type, venue and customer message. Internal notes and contact details are
excluded from the index. Index/query language is `none`, so whole tokens match
without English stop-word removal or suffix stemming. Search is case insensitive.
Multiple unquoted words match any term; quotes require a phrase and a minus prefix
excludes a term. This follows [MongoDB 7 text-query semantics](https://www.mongodb.com/docs/v7.0/reference/operator/query/text/).
This is indexed word search, not arbitrary substring matching.

Results sort by creation time descending then ID descending. Queries retrieve at
most `limit + 1` documents with a five-second server execution limit. The existing
creation-time/ID index serves unfiltered reads. The text index handles term search;
search sorting may require MongoDB's bounded in-memory sorting. Narrow a query if
it times out or reaches the capped window. Offset pages are observations, not a
transactional export snapshot: concurrent inserts or changes can shift pages.

The download control fetches a fresh authorised export page and saves JSON.
Each summary allows exactly: `id`, `reference`, `name`, `event_type`,
`preferred_date`, `collection`, `created_at`, `studio_status`, `studio_revision`.
Email, phone, venue, messages, consent, internal notes, actor IDs, provider states,
payload hashes, credentials and unrecognised future fields are excluded. There is
no CSV output; customer values that look like spreadsheet formulas remain JSON
strings and are not emitted into executable spreadsheet cells. The control names
the page and reports its count; it does not imply a complete database download.

## Bulk triage

`POST /api/studio/operations/bulk-triage` accepts one `studio_status` and 1–50
distinct `items`, each containing `id` and `expected_revision`. Unknown fields,
unsupported statuses, boolean/coerced revisions and duplicate targets are rejected.
The frontend selects records from the currently displayed page and submits their
saved revision values.

The request requires the established staff session, allowed origin and CSRF token.
The session, role, disable/reset state and CSRF token are rechecked for each record.
All supported staff currently have enquiry triage access; this feature introduces
no new roles or email-based access. Each write uses the existing inbox's atomic
compare-and-set revision contract, preserving customer fields and existing notes
and recording staff actor and timestamp. Archiving retains the record.

Results explicitly identify `updated`, `conflict` or `not_found` per record.
An unavailable database stops further attempts, returning `unavailable` for the
uncertain record and `not_attempted` for remaining records. Lost authorisation
returns `authorization_lost` and stops further attempts; the UI exits the private
page. The batch is intentionally not all-or-nothing: successful earlier saves
remain persisted, and every outcome is shown.

Retries use the same revision fences. A completed write cannot be applied twice
with its original revision. After a lost response or database error, refresh and
review current records before submitting another change. The client never
automatically repeats a bulk write. Notes are edited only through the existing
individual enquiry editor.

All reads, writes and errors inherit `Cache-Control: no-store`. Clients and
anonymous visitors cannot search, export or bulk-update staff records.

## Verification

With an isolated MongoDB replica set:

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' \
  .venv/bin/python -m pytest -q backend/tests/test_enquiry_operations.py
BROWSER_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' \
  .venv/bin/python web/tests/run_browser.py
```

Backend coverage checks every search field, note exclusion, index metadata,
pagination/export privacy and bounds, malformed bodies, CSRF, client isolation,
expiry, concurrent updates, retry safety, partial failure and mid-batch disable.
The browser suite exercises actual API reads, an actual downloaded JSON file,
partial/stale saves, reload persistence, lost successful write responses followed
by manual refresh, empty search, narrow screens and client/logout denial.
Successful API paths use real application handlers and real MongoDB records;
response interception is limited to the lost-response failure scenario.
