-- Q5: Migrate secretary transactions (user id prefix 6487c846) from transactions -> cash_ledger_entries
-- Strategy: backup first, migrate, verify count+amount, then optional delete with explicit flag.
-- Safe to run multiple times for migrate step (uses NOT EXISTS guard by transaction id marker in notes).

BEGIN;

-- 0) Parameters
-- Change this if needed
DO $$
BEGIN
  IF current_setting('app.q5_user_prefix', true) IS NULL THEN
    PERFORM set_config('app.q5_user_prefix', '6487c846', true);
  END IF;
END $$;

-- 1) Backup source rows before any mutation
CREATE TABLE IF NOT EXISTS public.transactions_backup_q5_6487c846 AS
SELECT t.*
FROM public.transactions t
WHERE false;

INSERT INTO public.transactions_backup_q5_6487c846
SELECT t.*
FROM public.transactions t
WHERE t.created_by::text LIKE current_setting('app.q5_user_prefix') || '%'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions_backup_q5_6487c846 b WHERE b.id = t.id
  );

-- 2) Migrate into cash_ledger_entries
-- Mapping:
--  - type/amount/transaction_date/status/notes/description/slip/code/bank fields are kept
--  - entry_kind defaults to 'ops'
--  - transfer_group_id is NULL for historical rows
--  - notes receives migration marker for idempotency and traceability
INSERT INTO public.cash_ledger_entries (
  created_by,
  type,
  entry_kind,
  amount,
  transaction_date,
  status,
  recipient_user_id,
  recipient_name,
  bank_name,
  bank_account,
  transaction_code,
  description,
  notes,
  slip_image_url,
  approved_by,
  approved_at,
  reject_reason,
  transfer_group_id,
  linked_entry_id
)
SELECT
  t.created_by,
  CASE
    WHEN t.type IN ('income','expense') THEN t.type
    ELSE CASE WHEN COALESCE(t.adjustment_direction,'') = 'increase' THEN 'income' ELSE 'expense' END
  END AS mapped_type,
  'ops'::text AS entry_kind,
  ABS(COALESCE(t.amount, 0))::numeric(15,2) AS amount,
  COALESCE(t.transaction_date, t.created_at, NOW()) AS transaction_date,
  CASE
    WHEN t.status IN ('pending','approved','rejected') THEN t.status
    ELSE 'pending'
  END AS status,
  NULL::uuid AS recipient_user_id,
  t.recipient_name,
  t.bank_name,
  t.bank_account,
  t.transaction_code,
  t.description,
  CONCAT('[Q5 MIGRATED from transactions.id=', t.id, '] ', COALESCE(t.notes, '')) AS notes,
  t.slip_image_url,
  t.approved_by,
  t.approved_at,
  t.reject_reason,
  NULL::uuid,
  NULL::bigint
FROM public.transactions t
WHERE t.created_by::text LIKE current_setting('app.q5_user_prefix') || '%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_ledger_entries c
    WHERE c.notes LIKE CONCAT('[Q5 MIGRATED from transactions.id=', t.id, ']%')
  );

-- 3) Verification snapshot
-- Compare source in transactions vs migrated rows in cash_ledger_entries (by marker)
CREATE TABLE IF NOT EXISTS public.q5_migration_audit_6487c846 (
  audited_at timestamptz not null default now(),
  src_count bigint,
  src_total numeric(18,2),
  dst_count bigint,
  dst_total numeric(18,2),
  is_match boolean
);

INSERT INTO public.q5_migration_audit_6487c846 (src_count, src_total, dst_count, dst_total, is_match)
WITH src AS (
  SELECT
    COUNT(*)::bigint AS c,
    COALESCE(SUM(ABS(COALESCE(amount,0))), 0)::numeric(18,2) AS s
  FROM public.transactions
  WHERE created_by::text LIKE current_setting('app.q5_user_prefix') || '%'
),
dst AS (
  SELECT
    COUNT(*)::bigint AS c,
    COALESCE(SUM(ABS(COALESCE(amount,0))), 0)::numeric(18,2) AS s
  FROM public.cash_ledger_entries
  WHERE notes LIKE '[Q5 MIGRATED from transactions.id=%'
)
SELECT src.c, src.s, dst.c, dst.s, (src.c = dst.c AND src.s = dst.s)
FROM src, dst;

COMMIT;

-- 4) Manual verify query (run separately)
-- SELECT * FROM public.q5_migration_audit_6487c846 ORDER BY audited_at DESC LIMIT 5;
-- SELECT COUNT(*) AS src_count, COALESCE(SUM(ABS(amount)),0) AS src_total FROM public.transactions WHERE created_by::text LIKE '6487c846%';
-- SELECT COUNT(*) AS dst_count, COALESCE(SUM(ABS(amount)),0) AS dst_total FROM public.cash_ledger_entries WHERE notes LIKE '[Q5 MIGRATED from transactions.id=%';

-- 5) DELETE step (run ONLY after verify is_match=true)
-- BEGIN;
-- DELETE FROM public.transactions
-- WHERE created_by::text LIKE '6487c846%';
-- COMMIT;

-- 6) Rollback helper (if needed)
-- BEGIN;
-- INSERT INTO public.transactions
-- SELECT b.*
-- FROM public.transactions_backup_q5_6487c846 b
-- WHERE NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = b.id);
-- COMMIT;
