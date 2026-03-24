-- Repair 3 secretary cash-ledger rows that were mistakenly saved as ops expense
-- instead of fund_transfer_out, so no recipient operational income was auto-created.
--
-- HOW TO USE:
-- 1) Replace the values inside target_rows with the 3 wrong cash_ledger_entries ids.
-- 2) Run preview queries first.
-- 3) Run the transaction block.
--
-- This script will:
-- - backup the target rows
-- - change entry_kind from ops -> fund_transfer_out
-- - attach recipient_user_id / recipient_name
-- - create missing recipient income rows in transactions
--
-- IMPORTANT: set the recipient per row correctly (likely housekeeper). Do not run blindly.

-- Preview target rows
-- SELECT id, created_by, entry_kind, amount, transaction_date, recipient_user_id, recipient_name, description, notes
-- FROM public.cash_ledger_entries
-- WHERE id IN (/* put 3 ids here */)
-- ORDER BY id;

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix AS
SELECT * FROM public.cash_ledger_entries WHERE false;

WITH target_rows AS (
  -- Replace these sample rows before running
  -- cash_ledger_entry_id | recipient_user_id | recipient_name
  SELECT * FROM (VALUES
    (0::bigint, '00000000-0000-0000-0000-000000000000'::uuid, 'REPLACE_ME'),
    (0::bigint, '00000000-0000-0000-0000-000000000000'::uuid, 'REPLACE_ME'),
    (0::bigint, '00000000-0000-0000-0000-000000000000'::uuid, 'REPLACE_ME')
  ) AS v(cash_ledger_entry_id, recipient_user_id, recipient_name)
  WHERE cash_ledger_entry_id <> 0
),
backup_rows AS (
  INSERT INTO public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix
  SELECT c.*
  FROM public.cash_ledger_entries c
  JOIN target_rows t ON t.cash_ledger_entry_id = c.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix b
    WHERE b.id = c.id
  )
  RETURNING id
),
updated_rows AS (
  UPDATE public.cash_ledger_entries c
  SET
    entry_kind = 'fund_transfer_out',
    recipient_user_id = t.recipient_user_id,
    recipient_name = t.recipient_name,
    transfer_group_id = COALESCE(c.transfer_group_id, gen_random_uuid()),
    notes = CONCAT('[REPAIRED OPS->TRANSFER] ', COALESCE(c.notes, ''))
  FROM target_rows t
  WHERE c.id = t.cash_ledger_entry_id
    AND c.created_by::text LIKE '6487c846%'
  RETURNING c.*
)
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
  'income'::text,
  ABS(COALESCE(u.amount, 0))::numeric(15,2),
  NULL::bigint,
  NULL::bigint,
  COALESCE(u.description, 'Thu quỹ được chuyển từ thư ký'),
  u.recipient_name,
  u.bank_name,
  u.bank_account,
  u.transaction_code,
  COALESCE(u.transaction_date, u.created_at, NOW()),
  CONCAT('[AUTO_FUND_TRANSFER:', COALESCE(u.transfer_group_id::text, CONCAT('legacy-', u.id::text)), '] repaired from secretary ops mis-tag cash_ledger_entries.id=', u.id, '. ', COALESCE(u.notes, '')),
  u.recipient_user_id,
  u.slip_image_url,
  'approved'::text,
  u.created_by,
  COALESCE(u.approved_at, NOW()),
  u.created_by,
  COALESCE(u.approved_at, NOW()),
  'manual'::text,
  jsonb_build_object(
    'repair_source_cash_ledger_entry_id', u.id,
    'transfer_group_id', u.transfer_group_id,
    'repair_reason', 'secretary_ops_should_have_been_transfer_out'
  )
FROM updated_rows u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.transactions t
  WHERE t.notes LIKE CONCAT('[AUTO_FUND_TRANSFER:', COALESCE(u.transfer_group_id::text, CONCAT('legacy-', u.id::text)), ']%')
    AND t.created_by = u.recipient_user_id
    AND ABS(COALESCE(t.amount,0)) = ABS(COALESCE(u.amount,0))
);

COMMIT;

-- Verify after run
-- SELECT id, entry_kind, recipient_user_id, recipient_name, transfer_group_id, amount
-- FROM public.cash_ledger_entries
-- WHERE notes LIKE '[REPAIRED OPS->TRANSFER]%'
-- ORDER BY id DESC;
--
-- SELECT id, created_by, amount, transaction_date, source, notes
-- FROM public.transactions
-- WHERE notes LIKE '[AUTO_FUND_TRANSFER:%'
-- ORDER BY id DESC;
