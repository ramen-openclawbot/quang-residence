-- =============================================
-- ZenHome — Supabase Storage Setup
-- Run in Supabase SQL Editor AFTER schema.sql
-- =============================================

-- 1. Create storage bucket for bank slips
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-slips',
  'bank-slips',
  true,          -- public so images are viewable in dashboard
  10485760,      -- 10MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS Policies for storage

-- Allow authenticated users to upload
CREATE POLICY "auth_upload_bank_slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bank-slips'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view all slips (owner/secretary need this)
CREATE POLICY "auth_read_bank_slips"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bank-slips');

-- Allow users to delete their own slips
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
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'pending_approval', 'reminder', 'report')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY "notifications_own" ON notifications FOR ALL
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- =============================================
-- 4. pg_cron daily report job (if pg_cron is enabled)
-- Supabase Pro has pg_cron. On Free tier, use Vercel Cron instead.
-- Uncomment if on Pro plan:
-- =============================================

-- SELECT cron.schedule(
--   'zenhome-daily-report',
--   '0 22 * * *',  -- Every day at 22:00 UTC (5 AM Vietnam = UTC+7 → 22:00 UTC previous day)
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://your-app.vercel.app/api/cron/daily-report',
--       headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
--       body := '{}'::jsonb
--     )
--   $$
-- );
