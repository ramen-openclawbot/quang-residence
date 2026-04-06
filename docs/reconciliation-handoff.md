# Reconciliation Handoff Notes

## Current conclusion (2026-04-06)

### Matching truth
1. Reconciliation should primarily trust **transaction code**.
2. Statement-side suffixes like `BNK` or `/BNK` should be normalized away.
3. Do **not** over-relax the main body of the transaction code for final match decisions.
4. If the app-side transaction code differs in the core digits, the likely root cause is **OCR misread**, not a reconciliation bug.

### OCR issue identified
A confirmed failure mode exists where OCR reads transaction codes incorrectly (example: app saved an extra `0` in the middle of an `FT...` code even though the slip image itself was correct).
This causes otherwise-valid transactions to fall into `needsReview` instead of `matched`.

## Follow-up task (do later)
Build an OCR hardening pass specifically for `transaction_code` extraction:
- improve extraction prompt/rules for `FT...` transaction references
- add post-processing / validation for transaction code patterns
- highlight suspicious OCR transaction codes in UI before final submit
- reduce false `needsReview` caused by OCR code mistakes

This is intentionally deferred.

---

## Product decision approved now
Add **manual approval** inside the reconciliation section for `needsReview` items.

### Desired behavior
For each item in `needsReview`:
- secretary can manually approve that the statement row and app transaction are the same transaction
- once approved:
  - it moves from `needsReview` to `matched`
  - UI should record and display **why it was approved**

### Reason examples
Examples of reason copy:
- `Approved manually: same real transaction, bank statement date differs from slip date`
- `Approved manually: transaction code OCR mismatch`
- `Approved manually: same amount / same direction / same recipient`

### Data behavior expected
After manual approval:
- reconciliation result should treat that pair as `matched`
- it should no longer remain in `needsReview`
- the approval reason should be preserved and visible

### Recommended future implementation direction
Likely needs one of:
- persisted reconciliation review decisions in DB
- or a reconciliation session store tied to uploaded statement rows

Do not lose the human review decision after refresh/re-run once implemented fully.
