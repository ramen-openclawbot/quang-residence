-- Fix historical bug: auto-created transfer income was wrongly inserted into cash_ledger_entries
-- Correct behavior: secretary transfer-out stays in cash_ledger_entries,
-- recipient income must live in transactions.
--
-- This script:
-- 1) backs up wrong rows (`entry_kind = 'fund_transfer_in_auto'`)
-- 2) inserts missing recipient income rows into transactions
-- 3) verifies counts
-- 4) deletes the wrong cash_ledger rows only after migration step
--
-- Run in Supabase SQL Editor after reviewing the preview queries below.

BEGIN;

-- 0) Backup table
CREATE TABLE IF NOT EXISTS public.cash_ledger_entries_backup_transfer_auto_income_bug AS
SELECT * FROM public.cash_ledger_entries WHERE false;

INSERT INTO public.cash_ledger_entries_backup_transfer_auto_income_bug
SELECT c.*
FROM public.cash_ledger_entries c
WHERE c.entry_kind = 'fund_transfer_in_auto'
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_ledger_entries_backup_transfer_auto_income_bug b
    WHERE b.id = c.id
  );

-- 1) Insert missing recipient-side operational income into transactions
-- Marker allows idempotent reruns.
INSERT INTO public.transactions (
  type,
  amount,
  fund_id,
  category_id,
  description,
  recipient_name,
  bank_name,
  bank_account,
  transaction_code,
  transaction_date,
  notes,
  created_by,
  slip_image_url,
  status,
  approved_by,
  approved_at,
  reviewed_by,
  reviewed_at,
  source,
  ocr_raw_data
)
SELECT
  'income'::text AS type,
  ABS(COALESCE(c.amount, 0))::numeric(15,2) AS amount,
  NULL::bigint AS fund_id,
  NULL::bigint AS category_id,
  COALESCE(c.description, 'Thu quỹ được chuyển tự động') AS description,
  COALESCE(c.recipient_name, p.full_name) AS recipient_name,
  c.bank_name,
  c.bank_account,
  c.transaction_code,
  COALESCE(c.transaction_date, c.created_at, NOW()) AS transaction_date,
  CONCAT('[AUTO_FUND_TRANSFER:', COALESCE(c.transfer_group_id::text, CONCAT('legacy-', c.id::text)), '] repaired from cash_ledger_entries.id=', c.id, '. ', COALESCE(c.notes, '')) AS notes,
  c.created_by,
  c.slip_image_url,
  COALESCE(NULLIF(c.status, ''), 'approved') AS status,
  c.approved_by,
  c.approved_at,
  c.approved_by,
  c.approved_at,
  'manual'::text AS source,
  jsonb_build_object(
    'repair_source_cash_ledger_entry_id', c.id,
    'transfer_group_id', c.transfer_group_id,
    'linked_entry_id', c.linked_entry_id,
    'repair_reason', 'misrouted_fund_transfer_income'
  ) AS ocr_raw_data
FROM public.cash_ledger_entries c
LEFT JOIN public.profiles p ON p.id = c.created_by
WHERE c.entry_kind = 'fund_transfer_in_auto'
  AND NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.notes LIKE CONCAT('[AUTO_FUND_TRANSFER:', COALESCE(c.transfer_group_id::text, CONCAT('legacy-', c.id::text)), ']%')
      AND t.created_by = c.created_by
      AND ABS(COALESCE(t.amount, 0)) = ABS(COALESCE(c.amount, 0))
      AND COALESCE(t.transaction_code, '') = COALESCE(c.transaction_code, '')
  );

-- 2) Audit snapshot
CREATE TABLE IF NOT EXISTS public.transfer_auto_income_repair_audit (
  audited_at timestamptz NOT NULL DEFAULT now(),
  source_cash_ledger_count bigint,
  target_transaction_count bigint,
  source_total numeric(18,2),
  target_total numeric(18,2),
  is_match boolean
);

INSERT INTO public.transfer_auto_income_repair_audit (
  source_cash_ledger_count,
  target_transaction_count,
  source_total,
  target_total,
  is_match
)
WITH src AS (
  SELECT
    COUNT(*)::bigint AS c,
    COALESCE(SUM(ABS(COALESCE(amount,0))), 0)::numeric(18,2) AS s
  FROM public.cash_ledger_entries
  WHERE entry_kind = 'fund_transfer_in_auto'
),
dst AS (
  SELECT
    COUNT(*)::bigint AS c,
    COALESCE(SUM(ABS(COALESCE(amount,0))), 0)::numeric(18,2) AS s
  FROM public.transactions
  WHERE notes LIKE '[AUTO_FUND_TRANSFER:%'
)
SELECT src.c, dst.c, src.s, dst.s, (dst.c >= src.c AND dst.s >= src.s)
FROM src, dst;

COMMIT;

-- 3) Preview before delete
-- SELECT * FROM public.transfer_auto_income_repair_audit ORDER BY audited_at DESC LIMIT 5;
-- SELECT id, created_by, amount, transaction_date, transfer_group_id, linked_entry_id
-- FROM public.cash_ledger_entries
-- WHERE entry_kind = 'fund_transfer_in_auto'
-- ORDER BY id DESC;
--
-- SELECT id, created_by, amount, transaction_date, source, notes
-- FROM public.transactions
-- WHERE notes LIKE '[AUTO_FUND_TRANSFER:%'
-- ORDER BY id DESC;

-- 4) Delete wrong rows from cash ledger ONLY after verification
-- BEGIN;
-- DELETE FROM public.cash_ledger_entries
-- WHERE entry_kind = 'fund_transfer_in_auto';
-- COMMIT;

-- 5) Rollback helper if needed
-- BEGIN;
-- DELETE FROM public.transactions
-- WHERE notes LIKE '[AUTO_FUND_TRANSFER:%'
--   AND source = 'manual';
--
-- INSERT INTO public.cash_ledger_entries
-- SELECT b.*
-- FROM public.cash_ledger_entries_backup_transfer_auto_income_bug b
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.cash_ledger_entries c WHERE c.id = b.id
-- );
-- COMMIT;
