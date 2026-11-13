# Pending patches to the design reference

Changes that belong in the design-system source of truth (`_ds/`, exported from the
Claude Design project) but cannot be applied here: `_ds/` is kept byte-for-byte as
exported and is verified by `scripts/audit-design-source.py`. Apply these in the design
project, then re-export.

## finance-core-wage-cashflow.patch

Applies to `_ds/uploads/finance-core.jsx`.

Cash flow summed gross wages, while the ledger credits the bank net of PAYG withholding,
so closing balances disagreed by the accumulated withholding. The patch makes cash paid
for a wage `gross - withheld`, the same figure the ledger uses.

The mobile app's engine (`apps/mobile/src/data/finance.ts`) already has this fix and a
test for it (`apps/mobile/e2e/finance.js`). Until the patch is applied to the reference,
the reference and the mobile app report different cash balances.

Status: the patch applies cleanly (`git apply --check`); the patched reference engine has
not been run.
