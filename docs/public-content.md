# Website narrative editing

The staff website narrative screen manages four existing plain text fields: hero description, hero footnote, philosophy title and philosophy description. Their original source is the current public Landing page. Initial public reads use that original copy until staff publishes a saved draft.

Staff save, publish and restore are separate authenticated operations with Origin/CSRF checks. Saving persists a draft without changing public content. Publishing atomically replaces the public snapshot. Restoring a historical version (or original source revision 0) changes the draft only; it requires a separate publish action to affect the website. Public responses contain only the four validated fields and published revision, excluding actors, history and drafts. React renders values as text; markup remains literal text.

Each mutation carries a UUID command ID and expected global revision. Identical retries return the recorded outcome. Reusing an ID for a different change or submitting a stale revision returns 409. Staff identity and session writes inside each transaction fence concurrent disable, password reset and logout. Versions preserve actor, UTC timestamp, action and the four-field snapshot. History reads are bounded to 100 versions with a continuation revision. MongoDB must be a transaction-capable replica set; indexes enforce command and history revision uniqueness.

This editor excludes package contents, prices, tax, deposits, cancellations, access periods, contractual terms, media URLs and featured images. Those require their own approved sources and storage controls. Narrative validation limits shape, length and control characters; it does not infer or approve commercial policy. Staff must keep narrative changes within established authorisation.

API routes:

- `GET /api/public/content`: public published snapshot.
- `GET /api/studio/content`: staff draft and published state.
- `POST /api/studio/content/draft`: `{command_id, expected_revision, content}`.
- `POST /api/studio/content/publish`: `{command_id, expected_revision}`.
- `POST /api/studio/content/restore`: `{command_id, expected_revision, source_revision}`.
- `GET /api/studio/content/history?after=-1`: ordered version page.

Verification: `TEST_MONGODB_URI='<isolated replica URI>' .venv/bin/python -m pytest backend/tests/test_public_content.py -q` and the `web/tests/public_content.py` real-endpoint browser suite. Tests cover concurrent writes, retries, stale changes, allowlisted validation, CSRF, staff disable races, draft/public separation, restore and literal text rendering. No live deployment is performed.
