-- Permission hardening: users can only edit/delete their own work items
-- Owner keeps full control
-- Secretary can view all agenda but only modify rows they own (unless owner)
-- Safe to run multiple times

-- TASKS
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
) WITH CHECK (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
);

-- HOME MAINTENANCE
DROP POLICY IF EXISTS "maintenance_update" ON public.home_maintenance;
CREATE POLICY "maintenance_update" ON public.home_maintenance FOR UPDATE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
) WITH CHECK (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
);

DROP POLICY IF EXISTS "maintenance_delete" ON public.home_maintenance;
CREATE POLICY "maintenance_delete" ON public.home_maintenance FOR DELETE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
  OR reported_by = auth.uid()
);

-- FAMILY SCHEDULE
DROP POLICY IF EXISTS "schedule_update" ON public.family_schedule;
CREATE POLICY "schedule_update" ON public.family_schedule FOR UPDATE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
) WITH CHECK (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "schedule_delete" ON public.family_schedule;
CREATE POLICY "schedule_delete" ON public.family_schedule FOR DELETE USING (
  public.get_user_role() = 'owner'
  OR created_by = auth.uid()
);

-- DRIVING TRIPS
DROP POLICY IF EXISTS "trips_modify" ON public.driving_trips;
CREATE POLICY "trips_modify" ON public.driving_trips FOR ALL USING (
  public.get_user_role() = 'owner'
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
) WITH CHECK (
  public.get_user_role() = 'owner'
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
);
