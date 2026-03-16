-- Manual adjustment migration for existing production databases
-- Run this in Supabase SQL editor before using the Adjust submit flow.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income', 'expense', 'adjustment'));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS adjustment_direction TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS linked_transaction_id INTEGER REFERENCES public.transactions(id);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_adjustment_direction_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_adjustment_direction_check
  CHECK (adjustment_direction IS NULL OR adjustment_direction IN ('increase', 'decrease'));

CREATE INDEX IF NOT EXISTS idx_transactions_linked_transaction_id
  ON public.transactions(linked_transaction_id);
