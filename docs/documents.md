# Private enquiry documents and storage boundary

Staff can upload PDF, PNG or JPEG document versions for an explicitly granted enquiry/client relationship. Every upload starts private to the studio. A separate authorised publish action makes only that version available to that client. Unpublish withdraws future downloads while preserving the version and audit history. Previous downloads cannot be recalled.

This is document management, not electronic signature completion. No typed-name signature, consent evidence or signed workflow is exposed. Signature work is blocked pending a selected provider, consent process and evidence requirements. Documents and publication do not confirm bookings, set contractual terms or reserve availability.

## Configure private storage

Storage is disabled by default. The application does not create buckets, paid infrastructure or public object URLs.

For disposable local development/tests, set:

```dotenv
DOCUMENT_STORAGE_BACKEND=local
DOCUMENT_STORAGE_LOCAL_ROOT=/absolute/private/directory/outside/repository
DOCUMENT_MAX_BYTES=10485760
```

Local files use exclusive creation, restricted permissions and no-follow reads. Object identifiers consist only of server-created UUIDs; filenames cannot select a storage path. The local adapter rejects storage within the repository and production use. Railway's ephemeral application filesystem is not durable object storage.

For R2, set `DOCUMENT_STORAGE_BACKEND=r2` and the existing server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_ORIGINALS`. The account ID must be a 32-character hexadecimal ID. Use a private bucket with public bucket/website access disabled and appropriately scoped credentials. The adapter connects to `https://{account_id}.r2.cloudflarestorage.com`, region `auto`, and uses S3 conditional object creation. It does not set public ACLs or return presigned or public URLs. Bucket access configuration requires operator verification before live use.

`python-multipart==0.0.32` and `boto3==1.43.108` are pinned runtime dependencies. Existing framework dependencies are unchanged. R2 provider tests use botocore Stubber and establish adapter parameters/retry behavior; they do not establish successful Cloudflare integration. Live R2 verification requires unavailable isolated credentials and a verified private bucket.

## Contracts and persistence

Staff prefix: `/api/studio/enquiries/{enquiry_id}/documents/{client_id}`.

Client prefix: `/api/client/enquiries/{enquiry_id}/documents`.

- `GET` lists versions using ascending sequence cursor `after=0`, default `limit=25`, maximum 100. Client results include only ready, published versions and exclude internal history, actor, hashes and object keys.
- Staff `POST /uploads` initiates metadata: UUID `id`, UUID `document_id`, title, basename filename, supported content_type, exact size and hexadecimal SHA-256. Use an existing document_id for the next immutable version. Duplicate identical initiation by the same actor returns its current persisted status; conflicting reuse returns 409.
- Staff `POST /{version_id}/content` accepts exactly one multipart `file`. Authentication and transactional relationship checks occur before parsing. The parser counts streamed bytes, bounds the complete multipart request and closes temporary files on rejected requests. The expected size, MIME type, filename extension, file signature and SHA-256 must match. Supported types have PDF header/end markers, PNG signature/end marker, or JPEG start/end markers. These technical checks do not constitute malware scanning or full document-content validation.
- Staff `POST /{version_id}/publish` takes `published` and `expected_revision`. Only ready versions can be published. Revision conflicts return 409. An immediate matching retry by the same actor recovers the preceding committed outcome without a repeated history event.
- `GET /{version_id}/download` authorises the requested identity and explicit grant, checks publication for clients, loads the private object, verifies the recorded size and digest, and checks access again before streaming. It always returns attachment disposition, application/octet-stream, nosniff and no-store. Files are opened through the user's document reader after a protected download; the application does not embed active PDF content.

`document_versions` records immutable document metadata, version, relation, private object identifier, uploading/ready/failed status, publication, actor/timestamps, revisions and transition history. Per-document and per-grant heads allocate version/sequence numbers transactionally. Compound unique indexes prevent duplicate versions and sequence numbers; a publication/status/sequence index supports bounded client listing. Installation is additive; existing enquiries and access grants remain compatible. No records or objects are deleted.

Each active content upload holds a five-minute lease. Concurrent uploads get 409 while the lease is live. Failed validation or storage writes persist failed status and can be retried using identical metadata and UUID. A disconnected or interrupted upload can remain uploading until the lease expires; retry the same bytes afterward. An incomplete local object cannot be silently overwritten and requires a new version. Orphaned private objects after an interrupted finalisation remain inaccessible; no retention/deletion policy is invented.

The UI retains the initiation UUID through response loss, retries the same metadata and file, and recovers a committed ready upload. Refresh and later sessions read MongoDB state. Explicitly choosing a new upload after a failure creates a new version; older records remain visible to staff. Clients cannot upload, publish or inspect internal version activity.

## Verification

Run against isolated transaction-capable MongoDB; each document test configures a private temporary local storage directory:

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27027/?replicaSet=phase3' .venv/bin/python -m pytest backend/tests/test_documents.py
```

Tests cover persisted private uploads, immutable/concurrent initiation, retry recovery, publication revision conflicts, version pagination, failed uploads/retries, size/type/signature/digest validation, chunked request limits without Content-Length, private downloads, integrity failure, CSRF/role/cross-client/grant boundaries, access withdrawal during storage reads, safe local object paths/symlinks and R2 adapter parameters.

The browser runner creates isolated temporary local storage and starts real API/MongoDB fixtures. `web/tests/documents.py` exercises a real upload with lost committed response, retry without duplicate versions, separate publication, client download and exact bytes, persistent versions/reload, unpublish, private internal fields, mobile viewports and grant withdrawal. No live storage provider or signature-provider success is claimed.

Provider documentation consulted through Context7: [FastAPI file uploads](https://fastapi.tiangolo.com/tutorial/request-files/), [boto3 S3 guide](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/s3.html), and [Cloudflare R2 boto3 configuration](https://developers.cloudflare.com/r2/examples/aws/boto3/).
