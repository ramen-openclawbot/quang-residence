-- =============================================
-- ZenHome — Supabase Storage + Notifications
-- Safe to re-run in Supabase SQL Editor
-- Can be run BEFORE or AFTER schema.sql
-- =============================================

-- 1. Create storage bucket for bank slips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-slips',
  'bank-slips',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage policies
DROP POLICY IF EXISTS "auth_upload_bank_slips" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_bank_slips" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_own_slips" ON storage.objects;

CREATE POLICY "auth_upload_bank_slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "auth_read_bank_slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bank-slips'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'secretary')
    )
  )
);

CREATE POLICY "auth_delete_own_slips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- 3. Notifications table
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info'
    CHECK (type IN ('info', 'warning', 'pending_approval', 'reminder', 'report')),
  read_at TIMESTAMPTZ,
  link TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- =============================================
-- 4. Daily reports table
-- Must match app/api/cron/daily-report/route.js
-- =============================================
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  report_type TEXT DEFAULT 'daily_expense',
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS report_type TEXT DEFAULT 'daily_expense';
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS content JSONB;

-- Backward-compat migration for older shape (summary/data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'summary'
  ) THEN
    EXECUTE 'UPDATE public.daily_reports
             SET content = COALESCE(content, jsonb_build_object(''summary_text'', summary))
             WHERE summary IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'data'
  ) THEN
    EXECUTE 'UPDATE public.daily_reports
             SET content = COALESCE(content, data)
             WHERE data IS NOT NULL';
  END IF;
END $$;

-- =============================================
-- 5. Optional pg_cron daily report job (Supabase Pro only)
-- On Free tier, use Vercel Cron
-- =============================================
-- SELECT cron.schedule(
--   ''zenhome-daily-report'',
--   ''0 22 * * *'',
--   $$
--   SELECT net.http_post(
--     url     := ''https://YOUR_APP.vercel.app/api/cron/daily-report'',
--     headers := ''{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}''::jsonb,
--     body    := ''{}''::jsonb
--   )
--   $$
-- );
