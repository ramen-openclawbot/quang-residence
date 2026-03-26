-- Priority 1 security remediation for Supabase Advisor findings
-- Goal: immediately lock down temporary backup/audit tables created in public schema.
-- Strategy: enable RLS and add no permissive policies.
-- Result: PostgREST clients cannot read/write these tables unless using privileged roles.
--
-- Tables covered:
-- - public.cash_ledger_entries_backup_transfer_auto_income_bug
-- - public.transfer_auto_income_repair_audit
-- - public.transactions_backup_q5_6487c846
-- - public.q5_migration_audit_6487c846
-- - public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix
--
-- Safe to re-run.

BEGIN;

ALTER TABLE IF EXISTS public.cash_ledger_entries_backup_transfer_auto_income_bug ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transfer_auto_income_repair_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions_backup_q5_6487c846 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.q5_migration_audit_6487c846 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix ENABLE ROW LEVEL SECURITY;

-- Optional hardening: force RLS so even table owners must obey policies unless bypassrls/service role.
ALTER TABLE IF EXISTS public.cash_ledger_entries_backup_transfer_auto_income_bug FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transfer_auto_income_repair_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions_backup_q5_6487c846 FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.q5_migration_audit_6487c846 FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_ledger_entries_backup_secretary_ops_to_transfer_fix FORCE ROW LEVEL SECURITY;

COMMIT;

-- Verification helpers:
-- SELECT schemaname, tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'cash_ledger_entries_backup_transfer_auto_income_bug',
--     'transfer_auto_income_repair_audit',
--     'transactions_backup_q5_6487c846',
--     'q5_migration_audit_6487c846',
--     'cash_ledger_entries_backup_secretary_ops_to_transfer_fix'
--   )
-- ORDER BY tablename;
--
-- If these tables are no longer needed after audit/repair confirmation,
-- prefer dropping them completely in a later cleanup step.
