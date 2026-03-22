-- Q1: Secretary cash ledger foundation schema
-- Safe to run multiple times

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.cash_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),

  -- entry semantics
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('ops','fund_transfer_out','fund_transfer_in_auto')) DEFAULT 'ops',

  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  transaction_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),

  -- links / dedupe
  transfer_group_id UUID NULL,
  linked_entry_id BIGINT NULL REFERENCES public.cash_ledger_entries(id),

  -- metadata
  recipient_user_id UUID NULL REFERENCES public.profiles(id),
  recipient_name TEXT NULL,
  bank_name TEXT NULL,
  bank_account TEXT NULL,
  transaction_code TEXT NULL,
  description TEXT NULL,
  notes TEXT NULL,
  slip_image_url TEXT NULL,
  ocr_raw_data JSONB NULL,

  approved_by UUID NULL REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ NULL,
  reject_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_created_by ON public.cash_ledger_entries(created_by);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_status ON public.cash_ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON public.cash_ledger_entries(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_entry_kind ON public.cash_ledger_entries(entry_kind);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_transfer_group ON public.cash_ledger_entries(transfer_group_id);

-- Dedupe helper for transfer-in auto generation (same transfer group + recipient)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_transfer_recipient
ON public.cash_ledger_entries(transfer_group_id, created_by, entry_kind)
WHERE transfer_group_id IS NOT NULL AND entry_kind = 'fund_transfer_in_auto';

-- RLS baseline
ALTER TABLE public.cash_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_ledger_select" ON public.cash_ledger_entries;
CREATE POLICY "cash_ledger_select" ON public.cash_ledger_entries
FOR SELECT
USING (
  public.get_user_role() IN ('owner','secretary')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "cash_ledger_insert" ON public.cash_ledger_entries;
CREATE POLICY "cash_ledger_insert" ON public.cash_ledger_entries
FOR INSERT
WITH CHECK (
  public.get_user_role() IN ('owner','secretary')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "cash_ledger_update" ON public.cash_ledger_entries;
CREATE POLICY "cash_ledger_update" ON public.cash_ledger_entries
FOR UPDATE
USING (
  public.get_user_role() IN ('owner','secretary')
  OR created_by = auth.uid()
)
WITH CHECK (
  public.get_user_role() IN ('owner','secretary')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "cash_ledger_delete" ON public.cash_ledger_entries;
CREATE POLICY "cash_ledger_delete" ON public.cash_ledger_entries
FOR DELETE
USING (
  public.get_user_role() IN ('owner','secretary')
  OR created_by = auth.uid()
);

-- Optional sanity checks:
-- SELECT * FROM pg_policies WHERE tablename='cash_ledger_entries';
