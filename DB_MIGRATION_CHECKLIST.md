# DB Migration Checklist — 2026-03-14 evening

This checklist covers the schema/data follow-up needed so the latest transaction audit + fund-sync logic works correctly in Supabase.

## Why this exists
Recent code changes introduced / depend on:
- preserved rejected transactions (instead of deleting them)
- explicit review metadata on transactions
- transaction approval updating `funds.current_balance` when `fund_id` is present
- dashboard logic preferring real fund balances when available

If production DB is behind the current repo schema, the UI/API may partially work but audit/fund behavior will be incomplete.

---

## 1) Add review/audit columns to `transactions`
Run in Supabase SQL Editor if these columns do not already exist:

```sql
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reject_reason TEXT;
```

### Expected result
`transactions` should now contain:
- `status`
- `approved_by`
- `approved_at`
- `reviewed_by`
- `reviewed_at`
- `reject_reason`

---

## 2) Confirm `fund_id` exists on `transactions`
The current schema expects:

```sql
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES public.funds(id);
```

If the column already exists, no action needed.

---

## 3) Confirm transaction status allows `rejected`
Check that `transactions.status` supports:
- `pending`
- `approved`
- `rejected`

If the current DB was created from the shipped schema, this should already be true.

---

## 4) Confirm `funds` rows exist
The approval → fund sync flow only updates real rows in `public.funds`.
Make sure the seed funds exist.

Quick check:

```sql
SELECT id, name, fund_type, current_balance, budget_monthly
FROM public.funds
ORDER BY id;
```

Expected seed-style funds include entries like:
- Quỹ PR
- Quỹ tiền mặt
- Quỹ lương
- Chi gia đình
- Chi bếp

If missing, re-run the relevant section from `supabase/seed.sql`.

---

## 5) Optional: backfill older transactions with `fund_id`
Only new transactions created after the latest UI update will consistently carry `fund_id` from the form.
Older transactions may still have `fund_id IS NULL`.

### Impact
- approving old transactions without `fund_id` will **not** update any fund balance
- dashboards may still rely on fallback until new funded transactions accumulate

### Recommended action
For important historical pending transactions, manually assign `fund_id` before approval.

Example inspection query:

```sql
SELECT id, type, amount, description, status, fund_id, created_at
FROM public.transactions
WHERE fund_id IS NULL
ORDER BY created_at DESC;
```

---

## 6) Optional but recommended: review current rejected-flow history
Before this change, rejected transactions were deleted.
That means older rejected items do not exist in the DB anymore.
This is expected.

From this point onward, rejected transactions should remain in the ledger with:
- `status = 'rejected'`
- `reject_reason`
- `reviewed_by`
- `reviewed_at`

---

## 7) Manual QA after migration
After schema updates, test this exact flow:

### A. Reject flow
1. Submit a transaction
2. Review it from ledger
3. Reject with a reason
4. Verify:
   - transaction still exists
   - status = `rejected`
   - reject reason appears in detail view

### B. Approve + fund sync flow
1. Submit a new transaction
2. Select a fund in the form
3. Approve the transaction
4. Verify:
   - status = `approved`
   - chosen fund’s `current_balance` changes
   - owner/secretary balance cards begin reflecting synced fund data

### C. Dashboard source label
Check owner + secretary home:
- if fund balances exist → label should read `Synced from funds`
- if no fund balances exist yet → label may read `Ledger fallback`

---

## 8) Good next migration after this checklist
Not required immediately, but worth planning:
- audit log table for transaction lifecycle events
- stricter reconciliation between transaction approval and fund movements
- possibly prevent approving a transaction with missing `fund_id` when fund-sync is required by business rules

---

## Files related to this migration
- `app/api/transactions/route.js`
- `app/transactions/page.jsx`
- `components/TransactionForm.jsx`
- `supabase/schema.sql`
- `HANDOFF.md`
