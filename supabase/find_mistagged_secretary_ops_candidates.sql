-- Find secretary cash-ledger rows that were likely created as ops expense
-- but should have been fund_transfer_out to Trang.
--
-- Current secretary prefix: 6487c846%
-- Recipient Trang user id: a325bb7b-42ec-4c03-8390-ef5f1dca5cb5
--
-- Use this to identify the 3 wrong rows and copy their ids.

-- 1) Broad candidate list from cash ledger
SELECT
  c.id,
  c.created_by,
  c.entry_kind,
  c.type,
  c.amount,
  c.transaction_date,
  c.recipient_user_id,
  c.recipient_name,
  c.transaction_code,
  c.description,
  c.notes,
  c.created_at
FROM public.cash_ledger_entries c
WHERE c.created_by::text LIKE '6487c846%'
  AND c.type = 'expense'
  AND COALESCE(c.entry_kind, 'ops') = 'ops'
ORDER BY c.transaction_date DESC, c.id DESC;

-- 2) Narrow down likely rows mentioning Trang / transfer-like wording
SELECT
  c.id,
  c.amount,
  c.transaction_date,
  c.transaction_code,
  c.description,
  c.notes,
  c.created_at
FROM public.cash_ledger_entries c
WHERE c.created_by::text LIKE '6487c846%'
  AND c.type = 'expense'
  AND COALESCE(c.entry_kind, 'ops') = 'ops'
  AND (
    COALESCE(c.recipient_name, '') ILIKE '%trang%'
    OR COALESCE(c.description, '') ILIKE '%trang%'
    OR COALESCE(c.notes, '') ILIKE '%trang%'
    OR COALESCE(c.description, '') ILIKE '%chuyển%'
    OR COALESCE(c.notes, '') ILIKE '%chuyển%'
    OR COALESCE(c.description, '') ILIKE '%tạm ứng%'
    OR COALESCE(c.notes, '') ILIKE '%tạm ứng%'
    OR COALESCE(c.description, '') ILIKE '%quỹ%'
    OR COALESCE(c.notes, '') ILIKE '%quỹ%'
  )
ORDER BY c.transaction_date DESC, c.id DESC;

-- 3) Cross-check rows that do NOT yet have auto-created recipient income in transactions
SELECT
  c.id,
  c.amount,
  c.transaction_date,
  c.transaction_code,
  c.description,
  c.notes,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.created_by = 'a325bb7b-42ec-4c03-8390-ef5f1dca5cb5'::uuid
        AND t.type = 'income'
        AND ABS(COALESCE(t.amount, 0)) = ABS(COALESCE(c.amount, 0))
        AND DATE(t.transaction_date) = DATE(c.transaction_date)
        AND (
          COALESCE(t.transaction_code, '') = COALESCE(c.transaction_code, '')
          OR t.notes LIKE '[AUTO_FUND_TRANSFER:%'
        )
    ) THEN 'HAS_MATCHING_INCOME'
    ELSE 'MISSING_AUTO_INCOME'
  END AS recipient_income_status
FROM public.cash_ledger_entries c
WHERE c.created_by::text LIKE '6487c846%'
  AND c.type = 'expense'
  AND COALESCE(c.entry_kind, 'ops') = 'ops'
ORDER BY c.transaction_date DESC, c.id DESC;
