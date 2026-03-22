-- Phase T2: role-based RLS hardening for agenda visibility
-- Goal:
-- - owner + secretary: full visibility for maintenance/schedule
-- - housekeeper: only own maintenance/schedule rows
-- - driver: no access to maintenance/schedule
-- Safe to run multiple times

ALTER TABLE public.home_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_schedule ENABLE ROW LEVEL SECURITY;

-- =============================
-- HOME MAINTENANCE POLICIES
-- =============================
DROP POLICY IF EXISTS "maintenance_select" ON public.home_maintenance;
CREATE POLICY "maintenance_select" ON public.home_maintenance
FOR SELECT
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
);

DROP POLICY IF EXISTS "maintenance_insert" ON public.home_maintenance;
CREATE POLICY "maintenance_insert" ON public.home_maintenance
FOR INSERT
WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
  OR (
    public.get_user_role() = 'housekeeper'
    AND (created_by = auth.uid() OR reported_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "maintenance_update" ON public.home_maintenance;
CREATE POLICY "maintenance_update" ON public.home_maintenance
FOR UPDATE
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
)
WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
);

DROP POLICY IF EXISTS "maintenance_delete" ON public.home_maintenance;
CREATE POLICY "maintenance_delete" ON public.home_maintenance
FOR DELETE
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
);

-- remove legacy broad policy if exists
DROP POLICY IF EXISTS "maintenance_modify" ON public.home_maintenance;

-- =============================
-- FAMILY SCHEDULE POLICIES
-- =============================
DROP POLICY IF EXISTS "schedule_select" ON public.family_schedule;
CREATE POLICY "schedule_select" ON public.family_schedule
FOR SELECT
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "schedule_insert" ON public.family_schedule;
CREATE POLICY "schedule_insert" ON public.family_schedule
FOR INSERT
WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
  OR (public.get_user_role() = 'housekeeper' AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "schedule_update" ON public.family_schedule;
CREATE POLICY "schedule_update" ON public.family_schedule
FOR UPDATE
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
)
WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "schedule_delete" ON public.family_schedule;
CREATE POLICY "schedule_delete" ON public.family_schedule
FOR DELETE
USING (
  public.get_user_role() IN ('owner', 'secretary')
  OR created_by = auth.uid()
);

-- remove legacy broad policy if exists
DROP POLICY IF EXISTS "schedule_modify" ON public.family_schedule;

-- Optional sanity checks (run manually)
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('home_maintenance','family_schedule')
-- ORDER BY tablename, policyname;
