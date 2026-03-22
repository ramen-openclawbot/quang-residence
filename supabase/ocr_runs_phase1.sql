-- Phase 1: OCR observability foundation
-- Safe to run multiple times

CREATE TABLE IF NOT EXISTS public.ocr_runs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NULL,
  role TEXT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  bank_identifier TEXT NULL,
  template_used BOOLEAN NULL,
  amount_found BOOLEAN NULL,
  date_found BOOLEAN NULL,
  code_found BOOLEAN NULL,
  latency_ms INTEGER NULL,
  error_type TEXT NULL,
  error_message TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_ocr_runs_created_at ON public.ocr_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_runs_success ON public.ocr_runs(success);
CREATE INDEX IF NOT EXISTS idx_ocr_runs_bank_identifier ON public.ocr_runs(bank_identifier);

-- Quick checks:
-- SELECT success, COUNT(*) FROM public.ocr_runs GROUP BY success;
-- SELECT bank_identifier, COUNT(*) FROM public.ocr_runs GROUP BY bank_identifier ORDER BY COUNT(*) DESC;
-- SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
--        percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
-- FROM public.ocr_runs WHERE latency_ms IS NOT NULL;
