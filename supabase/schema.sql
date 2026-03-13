-- =============================================
-- ZenHome v2.0 — Full Database Schema
-- Run in Supabase SQL Editor (Settings > SQL Editor)
-- =============================================

-- 0. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES (linked to Supabase Auth)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'secretary', 'housekeeper', 'driver')),
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'driver')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 2. CATEGORIES (expense/income classification)
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  icon_name TEXT DEFAULT 'file',
  color TEXT DEFAULT '#56c91d',
  fund_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. FUNDS (quỹ)
-- =============================================
CREATE TABLE IF NOT EXISTS funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  fund_type TEXT NOT NULL CHECK (fund_type IN ('pr', 'cash', 'salary', 'household', 'kitchen', 'other')),
  current_balance DECIMAL(15, 0) DEFAULT 0,
  budget_monthly DECIMAL(15, 0) DEFAULT 0,
  managed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. TRANSACTIONS (core table — thu/chi)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(15, 0) NOT NULL,
  currency TEXT DEFAULT 'VND',
  fund_id INTEGER REFERENCES funds(id),
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  recipient_name TEXT,
  bank_name TEXT,
  bank_account TEXT,
  transaction_code TEXT,
  transaction_date TIMESTAMPTZ,
  slip_image_url TEXT,
  ocr_raw_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  notes TEXT,
  source TEXT DEFAULT 'app' CHECK (source IN ('app', 'legacy_import', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. TASKS (task management)
-- =============================================
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'popup' CHECK (task_type IN ('popup', 'auction', 'maintenance', 'schedule', 'driving', 'recurring')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. TASK COMMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. AUCTIONS (đấu giá — Thuỷ quản lý)
-- =============================================
CREATE TABLE IF NOT EXISTS auctions (
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
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. SAVINGS & LOANS (tiết kiệm / vay)
-- =============================================
CREATE TABLE IF NOT EXISTS savings_loans (
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
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. HOME MAINTENANCE (bảo trì nhà — Trang)
-- =============================================
CREATE TABLE IF NOT EXISTS home_maintenance (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location_in_house TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'scheduled', 'in_progress', 'completed')),
  contractor_name TEXT,
  estimated_cost DECIMAL(15, 0),
  actual_cost DECIMAL(15, 0),
  reported_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. FAMILY SCHEDULE (lịch gia đình — Trang)
-- =============================================
CREATE TABLE IF NOT EXISTS family_schedule (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  schedule_type TEXT DEFAULT 'other' CHECK (schedule_type IN ('school', 'health', 'activity', 'other')),
  family_member TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  recurring TEXT DEFAULT 'once' CHECK (recurring IN ('once', 'daily', 'weekly', 'monthly')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. DRIVING TRIPS (chuyến xe — Trường)
-- =============================================
CREATE TABLE IF NOT EXISTS driving_trips (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  pickup_location TEXT,
  dropoff_location TEXT,
  scheduled_time TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. HOME SETTINGS (giữ nguyên từ v1)
-- =============================================
CREATE TABLE IF NOT EXISTS home_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. MONTHLY DATA (legacy — giữ cho dashboard)
-- =============================================
CREATE TABLE IF NOT EXISTS monthly_data (
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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES: everyone reads all profiles, only self can update
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid());

-- CATEGORIES: everyone can read
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);

-- FUNDS: owner+secretary see all, others see related funds
CREATE POLICY "funds_select" ON funds FOR SELECT USING (
  get_user_role() IN ('owner', 'secretary') OR managed_by = auth.uid()
);
CREATE POLICY "funds_modify" ON funds FOR ALL USING (
  get_user_role() IN ('owner', 'secretary')
);

-- TRANSACTIONS: owner sees all, secretary sees all, others see own
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  get_user_role() IN ('owner', 'secretary') OR created_by = auth.uid()
);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  get_user_role() IN ('secretary', 'housekeeper', 'driver')
);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (
  get_user_role() = 'owner' OR created_by = auth.uid()
);

-- TASKS: owner+secretary see all, others see assigned/own
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (
  get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid() OR created_by = auth.uid()
);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (
  get_user_role() IN ('owner', 'secretary')
);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (
  get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid()
);

-- TASK COMMENTS: viewable if can view parent task
CREATE POLICY "task_comments_select" ON task_comments FOR SELECT USING (true);
CREATE POLICY "task_comments_insert" ON task_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- AUCTIONS: owner+secretary only
CREATE POLICY "auctions_all" ON auctions FOR ALL USING (
  get_user_role() IN ('owner', 'secretary')
);

-- SAVINGS/LOANS: owner+secretary only
CREATE POLICY "savings_loans_all" ON savings_loans FOR ALL USING (
  get_user_role() IN ('owner', 'secretary')
);

-- HOME MAINTENANCE: owner+secretary+housekeeper
CREATE POLICY "maintenance_select" ON home_maintenance FOR SELECT USING (
  get_user_role() IN ('owner', 'secretary', 'housekeeper')
);
CREATE POLICY "maintenance_modify" ON home_maintenance FOR ALL USING (
  get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

-- FAMILY SCHEDULE: owner+secretary+housekeeper
CREATE POLICY "schedule_select" ON family_schedule FOR SELECT USING (
  get_user_role() IN ('owner', 'secretary', 'housekeeper')
);
CREATE POLICY "schedule_modify" ON family_schedule FOR ALL USING (
  get_user_role() IN ('owner', 'secretary', 'housekeeper')
);

-- DRIVING TRIPS: all can see, owner+secretary+driver can modify
CREATE POLICY "trips_select" ON driving_trips FOR SELECT USING (true);
CREATE POLICY "trips_modify" ON driving_trips FOR ALL USING (
  get_user_role() IN ('owner', 'secretary') OR assigned_to = auth.uid()
);

-- HOME SETTINGS: all can read, all can update
CREATE POLICY "home_settings_select" ON home_settings FOR SELECT USING (true);
CREATE POLICY "home_settings_update" ON home_settings FOR UPDATE USING (true);

-- MONTHLY DATA: all can read
CREATE POLICY "monthly_data_select" ON monthly_data FOR SELECT USING (true);

-- =============================================
-- AUTO-UPDATE updated_at on tasks
-- =============================================
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_fund_id ON transactions(fund_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_driving_trips_date ON driving_trips(scheduled_time);
