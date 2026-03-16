-- =============================================
-- ZenHome v2.0 — Core Database Schema
-- Safe to re-run in Supabase SQL Editor
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES (linked to Supabase Auth)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'secretary', 'housekeeper', 'driver')),
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create/update profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'driver')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 2. CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  parent_id INTEGER REFERENCES public.categories(id),
  icon_name TEXT DEFAULT 'file',
  color TEXT DEFAULT '#56c91d',
  fund_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. FUNDS
-- =============================================
CREATE TABLE IF NOT EXISTS public.funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fund_type TEXT NOT NULL UNIQUE CHECK (fund_type IN ('pr', 'cash', 'salary', 'household', 'kitchen', 'other')),
  current_balance DECIMAL(15, 0) DEFAULT 0,
  budget_monthly DECIMAL(15, 0) DEFAULT 0,
  managed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. TRANSACTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(15, 0) NOT NULL,
  currency TEXT DEFAULT 'VND',
  fund_id INTEGER REFERENCES public.funds(id),
  category_id INTEGER REFERENCES public.categories(id),
  description TEXT,
  recipient_name TEXT,
  bank_name TEXT,
  bank_account TEXT,
  transaction_code TEXT,
  transaction_date TIMESTAMPTZ,
  slip_image_url TEXT,
  ocr_raw_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  source TEXT DEFAULT 'app' CHECK (source IN ('app', 'legacy_import', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. TASKS
-- =============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'popup' CHECK (task_type IN ('popup', 'auction', 'maintenance', 'schedule', 'driving', 'recurring')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. TASK COMMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. AUCTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.auctions (
  id SERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  auction_house TEXT,
  auction_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'tracking' CHECK (status IN ('tracking', 'registered', 'bidding', 'won', 'lost', 'paid', 'shipping', 'received')),
  deposit_amount DECIMAL(15, 0) DEFAULT 0,
  final_price DECIMAL(15, 0),
  shipping_status TEXT,
  image_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. SAVINGS & LOANS
-- =============================================
CREATE TABLE IF NOT EXISTS public.savings_loans (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('savings', 'loan')),
  bank_name TEXT NOT NULL,
  account_number TEXT,
  principal_amount DECIMAL(15, 0) NOT NULL,
  interest_rate DECIMAL(5, 2),
  start_date DATE,
  maturity_date DATE,
  auto_renew BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matured', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. HOME MAINTENANCE
-- =============================================
CREATE TABLE IF NOT EXISTS public.home_maintenance (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location_in_house TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'scheduled', 'in_progress', 'completed')),
  contractor_name TEXT,
  estimated_cost DECIMAL(15, 0),
  actual_cost DECIMAL(15, 0),
  reported_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. FAMILY SCHEDULE
-- =============================================
CREATE TABLE IF NOT EXISTS public.family_schedule (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  schedule_type TEXT DEFAULT 'other' CHECK (schedule_type IN ('school', 'health', 'activity', 'other')),
  family_member TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  recurring TEXT DEFAULT 'once' CHECK (recurring IN ('once', 'daily', 'weekly', 'monthly')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. DRIVING TRIPS
-- =============================================
CREATE TABLE IF NOT EXISTS public.driving_trips (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  pickup_location TEXT,
  dropoff_location TEXT,
  scheduled_time TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. HOME SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.home_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. MONTHLY DATA
-- =============================================
CREATE TABLE IF NOT EXISTS public.monthly_data (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  spend DECIMAL(15, 0) DEFAULT 0,
  budget DECIMAL(15, 0) DEFAULT 5000,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driving_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_data ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "categories_select" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "funds_select" ON public.funds;
CREATE POLICY "funds_select" ON public.funds FOR SELECT USING (
  public.get_user_role() IN ('owner', 'secretary') OR managed_by = auth.uid()
);

DROP POLICY IF EXISTS "funds_modify" ON public.funds;
CREATE POLICY "funds_modify" ON public.funds FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary')
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
);

DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (
  public.get_user_role() IN ('owner', 'secretary') OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (
  public.get_user_role() IN ('secretary', 'housekeeper', 'driver')
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE USING (
  public.get_user_role() = 'owner' OR created_by = auth.uid()
) WITH CHECK (
  public.get_user_role() = 'owner' OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  public.get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid() OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary', 'driver')
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  public.get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid() OR created_by = auth.uid()
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid() OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auctions_all" ON public.auctions;
CREATE POLICY "auctions_all" ON public.auctions FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary')
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
);

DROP POLICY IF EXISTS "savings_loans_all" ON public.savings_loans;
CREATE POLICY "savings_loans_all" ON public.savings_loans FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary')
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary')
);

DROP POLICY IF EXISTS "maintenance_select" ON public.home_maintenance;
CREATE POLICY "maintenance_select" ON public.home_maintenance FOR SELECT USING (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

DROP POLICY IF EXISTS "maintenance_modify" ON public.home_maintenance;
CREATE POLICY "maintenance_modify" ON public.home_maintenance FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

DROP POLICY IF EXISTS "schedule_select" ON public.family_schedule;
CREATE POLICY "schedule_select" ON public.family_schedule FOR SELECT USING (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

DROP POLICY IF EXISTS "schedule_modify" ON public.family_schedule;
CREATE POLICY "schedule_modify" ON public.family_schedule FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

DROP POLICY IF EXISTS "trips_select" ON public.driving_trips;
CREATE POLICY "trips_select" ON public.driving_trips FOR SELECT USING (true);

DROP POLICY IF EXISTS "trips_modify" ON public.driving_trips;
CREATE POLICY "trips_modify" ON public.driving_trips FOR ALL USING (
  public.get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid()
) WITH CHECK (
  public.get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid()
);

DROP POLICY IF EXISTS "home_settings_select" ON public.home_settings;
CREATE POLICY "home_settings_select" ON public.home_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "home_settings_update" ON public.home_settings;
CREATE POLICY "home_settings_update" ON public.home_settings FOR UPDATE
USING (public.get_user_role() = 'owner')
WITH CHECK (public.get_user_role() = 'owner');

DROP POLICY IF EXISTS "monthly_data_select" ON public.monthly_data;
CREATE POLICY "monthly_data_select" ON public.monthly_data FOR SELECT USING (true);

-- =============================================
-- 14. OCR TEMPLATES
-- =============================================
CREATE TABLE IF NOT EXISTS public.ocr_templates (
  id SERIAL PRIMARY KEY,
  bank_name TEXT NOT NULL,
  bank_identifier TEXT UNIQUE NOT NULL,
  layout_hints JSONB,
  sample_extraction JSONB,
  extraction_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ocr_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_templates_select" ON public.ocr_templates;
CREATE POLICY "ocr_templates_select" ON public.ocr_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "ocr_templates_insert" ON public.ocr_templates;
CREATE POLICY "ocr_templates_insert" ON public.ocr_templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ocr_templates_update" ON public.ocr_templates;
CREATE POLICY "ocr_templates_update" ON public.ocr_templates FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_ocr_templates_bank ON public.ocr_templates(bank_identifier);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_fund_id ON public.transactions(fund_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_driving_trips_date ON public.driving_trips(scheduled_time);
