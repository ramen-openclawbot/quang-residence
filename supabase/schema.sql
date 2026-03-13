-- =============================================
-- ZenHome Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Monthly spending vs budget data
CREATE TABLE IF NOT EXISTS monthly_data (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  spend INTEGER NOT NULL DEFAULT 0,
  budget INTEGER NOT NULL DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Spending breakdown items
CREATE TABLE IF NOT EXISTS spending_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#56c91d',
  bg_color TEXT DEFAULT '#f0fdf4',
  icon_name TEXT DEFAULT 'shopping',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Agenda tasks (driver & secretary)
CREATE TABLE IF NOT EXISTS agenda_tasks (
  id SERIAL PRIMARY KEY,
  time TEXT NOT NULL,
  duration TEXT,
  title TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('scheduled', 'waiting', 'in-progress', 'pending', 'done')),
  category TEXT DEFAULT 'secretary' CHECK (category IN ('driver', 'secretary')),
  icon_name TEXT DEFAULT 'file',
  task_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Investments / assets
CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date_acquired TEXT,
  price TEXT,
  color TEXT DEFAULT '#56c91d',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Home settings (ambiance, devices, etc.)
CREATE TABLE IF NOT EXISTS home_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Enable Row Level Security (recommended)
-- =============================================
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read (anon key) for all tables
CREATE POLICY "Allow public read on monthly_data" ON monthly_data FOR SELECT USING (true);
CREATE POLICY "Allow public read on spending_items" ON spending_items FOR SELECT USING (true);
CREATE POLICY "Allow public read on agenda_tasks" ON agenda_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public read on investments" ON investments FOR SELECT USING (true);
CREATE POLICY "Allow public read on home_settings" ON home_settings FOR SELECT USING (true);

-- Allow updates for home_settings (for toggling devices, brightness, etc.)
CREATE POLICY "Allow public update on home_settings" ON home_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public update on agenda_tasks" ON agenda_tasks FOR UPDATE USING (true);
