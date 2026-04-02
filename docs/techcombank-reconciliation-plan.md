# Techcombank Statement Reconciliation Plan

## Goal
Build a reconciliation feature for ZenHome so a user can upload a real Techcombank bank statement Excel file, and the app will compare it against manually entered daily transactions to show whether the records match.

This feature is intended to support:
- monthly closing
- missing/extra transaction detection
- operational audit
- fund balance verification

---

## Business Logic Agreed

### Current app flow
- User scans UNC / bank slip
- User manually chooses expense category
- Transactions are entered daily into the app
- Fund balance in the app should reflect real money movement from bank statements

### Reconciliation purpose
Once a Techcombank statement file is uploaded, the app should use that file as the source of truth for actual money movement in the statement period.

The reconciliation result should mainly answer:
- which transactions were entered correctly
- which transactions are missing in the app
- which transactions exist in the app but do not appear in the statement
- which transactions are suspicious / need manual review

### Important clarification
For the agreed scope, reconciliation is primarily about **checking completeness and correctness of manual input against the bank statement**.

---

## Techcombank Statement Format (Current Understanding)

### File shape
- File type: `.xlsx`
- Usually 1 sheet
- Example sheet name: `AccountStatement_A4_Landscape`

### Header metadata found in sample
- Bank: Techcombank
- Customer name
- Customer ID
- Address
- Bilingual title: bank statement / debit-credit transaction

### Transaction table columns
Main columns identified in the statement table:

1. `Ngày giao dịch / Transaction Date`
2. `Đối tác / Remitter`
3. `NH Đối tác / Remitter Bank`
4. `Diễn giải / Details`
5. `Số bút toán / Transaction No`
6. `Nợ TKTT / Debit`
7. `Có TKTT / Credit`
8. `Số dư / Balance`

### Parsing rules
- There is an opening balance row before transaction rows
- Each transaction row has either:
  - debit amount, or
  - credit amount
- Balance is the post-transaction balance
- Transaction No is the strongest identifier when present

### Normalization rules
- Normalize date from `dd/mm/yyyy` to `yyyy-mm-dd`
- Remove commas from numeric values
- Convert debit/credit/balance to numbers
- Determine direction:
  - debit = money out
  - credit = money in
- Trim and normalize partner/bank/details fields

---

## Reconciliation Output Groups
The feature should classify results into 4 groups:

### 1. Matched
Transactions in the bank statement that correctly match transactions in the app.

### 2. Missing in app
Transactions found in the bank statement but not entered in the app.

### 3. Extra in app
Transactions entered in the app but not found in the bank statement for the selected statement period.

### 4. Needs review
Possible matches, but confidence is not high enough to auto-confirm.

---

## Matching Logic (v1)

### Strong match conditions
Prefer matching by:
1. exact amount
2. same direction (money in / money out)
3. same day or within allowed date window
4. matching or similar transaction description / partner
5. transaction number when available

### Recommended v1 matching priority
1. transaction number + amount
2. amount + direction + date
3. amount + direction + date + fuzzy text match

### Constraints
- 1 bank row should map to at most 1 app transaction
- Date tolerance for v1: same date or within 1 day

---

## Suggested Feature Phases

## Phase 1 — Spec + Parser Foundation
Deliverables:
- finalize Techcombank statement markdown spec
- build `.xlsx` parser for Techcombank format
- normalize rows into structured statement entries
- show parsed preview before reconciliation

Output of this phase:
- uploaded file can be parsed into clean transaction rows

---

## Phase 2 — Reconciliation Engine v1
Deliverables:
- compare uploaded statement rows against app transactions
- classify into:
  - matched
  - missing in app
  - extra in app
  - needs review
- calculate summary metrics:
  - total statement transactions
  - total app transactions in period
  - matched count
  - missing count
  - extra count
  - discrepancy amount

Output of this phase:
- app can generate a first useful reconciliation report

---

## Phase 3 — Reconciliation UI
Deliverables:
- add upload UI for statement file
- show parsing summary
- show reconciliation result summary cards
- show grouped result lists
- make review UI readable for non-technical users

Output of this phase:
- end-to-end usable reconciliation workflow in app

---

## Phase 4 — Review Actions
Deliverables:
- allow manual confirmation of candidate matches
- allow quick creation of missing transactions from statement rows
- allow marking rows as ignored where appropriate

Output of this phase:
- reconciliation becomes actionable, not just informational

---

## Phase 5 — Persistence + Audit Trail
Deliverables:
- store uploaded statement metadata
- store parsed statement entries
- store reconciliation result status
- preserve history of review decisions

Output of this phase:
- reconciliation can be revisited later and used for audit / monthly closing

---

## Data Model Recommendation
Suggested future tables:

### `bank_statement_uploads`
Store uploaded file metadata:
- id
- user/profile reference
- bank name
- account holder
- statement month
- file url/path
- uploaded by
- uploaded at

### `bank_statement_entries`
Store normalized rows:
- upload_id
- statement_date
- partner_name
- partner_bank
- details
- transaction_no
- debit
- credit
- balance
- direction
- matched_transaction_id
- match_status
- match_confidence

---

## Recommended Build Order
If building incrementally, recommended order is:

1. **Phase 1** — parser + spec
2. **Phase 2** — reconciliation engine
3. **Phase 3** — UI
4. **Phase 4** — review actions
5. **Phase 5** — persistence/audit trail

---

## Suggested v1 Scope
To keep implementation practical, version 1 should support only:
- Techcombank `.xlsx` statement format
- one uploaded file per reconciliation run
- one user/account per statement
- one statement period at a time
- summary + grouped discrepancy report

Not required in v1:
- multi-bank support
- PDF parsing
- OCR-based reconciliation
- multi-account merged reconciliation
- advanced one-to-many matching

---

## Decision Prompt for Next Step
Choose which phase to implement next:

- **Phase 1**: Build parser foundation
- **Phase 2**: Build reconciliation engine
- **Phase 3**: Build upload and reconciliation UI
- **Phase 4**: Build review actions
- **Phase 5**: Build persistence and audit trail
