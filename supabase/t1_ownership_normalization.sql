-- Phase T1: ownership normalization for maintenance + family schedule
-- Safe to run multiple times

ALTER TABLE public.home_maintenance
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- Backfill ownership for existing maintenance rows
UPDATE public.home_maintenance
SET created_by = reported_by
WHERE created_by IS NULL AND reported_by IS NOT NULL;

-- Backfill family_schedule ownership if null (best effort from latest active housekeeper profile)
UPDATE public.family_schedule fs
SET created_by = p.id
FROM (
  SELECT id
  FROM public.profiles
  WHERE role = 'housekeeper'
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
) p
WHERE fs.created_by IS NULL;

-- Optional check
-- SELECT COUNT(*) AS maintenance_missing_owner FROM public.home_maintenance WHERE created_by IS NULL;
-- SELECT COUNT(*) AS schedule_missing_owner FROM public.family_schedule WHERE created_by IS NULL;
