-- =============================================
-- ZenHome — Supabase Storage + Notifications
-- Run in Supabase SQL Editor
-- Can be run BEFORE or AFTER schema.sql
-- (uses auth.users instead of profiles for FK)
-- =============================================

-- 1. Create storage bucket for bank slips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-slips',
  'bank-slips',
  true,          -- public so images are viewable
  10485760,      -- 10MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS Policies for storage objects
-- (Drop first to avoid conflicts on re-run)
DROP POLICY IF EXISTS "auth_upload_bank_slips" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_bank_slips" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_own_slips" ON storage.objects;

-- Allow authenticated users to upload into their own folder
CREATE POLICY "auth_upload_bank_slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow all authenticated users to view slips (owner/secretary need this)
CREATE POLICY "auth_read_bank_slips"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bank-slips');

-- Allow users to delete their own slips only
CREATE POLICY "auth_delete_own_slips"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- 3. Notifications table
-- References auth.users (always exists in Supabase)
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  type          TEXT DEFAULT 'info'
                  CHECK (type IN ('info', 'warning', 'pending_approval', 'reminder', 'report')),
  read_at       TIMESTAMPTZ,           -- NULL = unread
  link          TEXT,
  payload       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read    ON notifications(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =============================================
-- 4. daily_reports table (used by cron handler)
-- =============================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id          BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  report_type TEXT DEFAULT 'daily_expense',
  content     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. pg_cron daily report job (Supabase Pro only)
-- On Free tier, use Vercel Cron (vercel.json already configured)
-- Uncomment below only if you are on Supabase Pro plan:
-- =============================================

-- SELECT cron.schedule(
--   'zenhome-daily-report',
--   '0 22 * * *',  -- 22:00 UTC = 05:00 Vietnam (UTC+7)
--   $$
--   SELECT net.http_post(
--     url     := 'https://YOUR_APP.vercel.app/api/cron/daily-report',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
--     body    := '{}'::jsonb
--   )
--   $$
-- );
