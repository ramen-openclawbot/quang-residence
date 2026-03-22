-- Phase 6 rollout ops columns for OCR canary/flags
-- Safe to run multiple times

ALTER TABLE public.ocr_runs
  ADD COLUMN IF NOT EXISTS phase2_fallback_enabled BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS canary_percent INTEGER NULL;
