# Canonical client contacts

`/studio/contacts` shows persisted client identities and the enquiry relationships
created by explicit invitations. It reuses canonical identity records; it creates
no separate shadow identities or automatic matches by email. Only staff may read
this roster. Client sessions have no access to it.

The list includes enabled and disabled client identities and returns only name,
email, enabled state and canonical ID. Detail lists saved grants and their enquiry
summaries; a grant is labelled active only if the account is enabled, the grant
is unrevoked and its enquiry exists. Password/session/invitation hashes, internal
notes and arbitrary future metadata are excluded. Stale relationships remain
visible to staff as unavailable; no record is deleted.

Keyset pages are bounded at100 records; indexes support role/id and client/id
filtering. Relationships follow client IDs and enquiry IDs only. Booking relations
will be added when the confirmed booking model is defined. Manual non-client
contact creation/editing remains outstanding and must not widen client access.

Verification: real MongoDB tests cover empty data, persistent profiles/grants,
pagination, disabled/missing contacts, cross-role denial and same-email enquiries
that do not gain relationships. Browser checks exercise the actual roster and links.
