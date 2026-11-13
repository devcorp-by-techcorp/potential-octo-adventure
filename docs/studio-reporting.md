# Studio reporting

Authenticated staff can view `/studio/reporting`. `GET /api/studio/reporting`
returns aggregate counts only, with an observation timestamp in UTC. Client
sessions cannot read this endpoint. Private responses use `Cache-Control: no-store`.

The report counts all saved `booking_requests`, including archived records.
Missing or null internal `studio_status` counts as **new**, matching legacy inbox
defaults. New, in-review and archived counts describe triage only. Unsupported
status values count as unclassified, so the status counts always sum to the total.

Enabled clients means identities with `role=client` and `enabled=true`. Active
enquiry access means explicit grants with no revocation timestamp, belonging to
an enabled client identity and pointing to an existing enquiry. Multiple enquiry
grants for one client are counted separately. Invitations, email matches, disabled
accounts, revoked grants and orphaned relationships do not count as active access.

These are operational observations, not booking, revenue or payment metrics.
Queries run concurrently and are not a transactional snapshot; concurrent writes
may change counts during the observation. Refresh obtains a new observation.
MongoDB aggregations return at most one row each and have a five-second server
execution limit. Repeatable non-destructive indexes cover enabled identities and
active grant filtering; joins use existing primary-key indexes. No record migration
or customer data export is performed.

Backend verification: `cd backend && pytest -q tests/test_studio_reporting.py`.
Use `TEST_MONGODB_URI` pointing to an isolated replica set for real persistence.
The suite checks empty and legacy records, unsupported statuses, enabled clients,
active/revoked/disabled/orphaned grants, exact source-record preservation, private
response schema, repeated index setup, invalidated staff sessions and client-role
denial. Database failures return a private service error rather than fabricated
zero counts.

Browser verification: with the test Python environment and frontend dependencies
installed, run `BROWSER_MONGODB_URI=<isolated-replica-set-uri> python web/tests/run_browser.py`
from the repository root. `web/tests/studio_reporting.py` exercises actual API reads
and saved MongoDB records, reload and refresh, narrow-screen layout, client-session
denial, service-error recovery and removal of stale counts after staff disable.
Only the negative service-error case intercepts a response; successful observations
come from the running application.
