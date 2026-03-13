-- =============================================
-- ZenHome Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
-- =============================================

-- Monthly Data
INSERT INTO monthly_data (month, spend, budget) VALUES
  ('Jan', 3200, 5000),
  ('Feb', 3800, 5000),
  ('Mar', 2600, 5000),
  ('Apr', 4200, 5000),
  ('May', 3400, 5000),
  ('Jun', 2200, 5000)
ON CONFLICT DO NOTHING;

-- Spending Items
INSERT INTO spending_items (name, description, amount, color, bg_color, icon_name, sort_order) VALUES
  ('Groceries', 'Weekly Restock', 1240.00, '#f97316', '#fff7ed', 'shopping', 1),
  ('Bill Payments', 'Electricity & Water', 450.20, '#3b82f6', '#eff6ff', 'zap', 2),
  ('Online Subscriptions', 'Netflix, Spotify, iCloud', 89.99, '#8b5cf6', '#f5f3ff', 'wifi', 3),
  ('Travel', 'Weekend Retreat', 2800.00, '#22c55e', '#f0fdf4', 'plane', 4)
ON CONFLICT DO NOTHING;

-- Agenda Tasks
INSERT INTO agenda_tasks (time, duration, title, location, status, category, icon_name, task_date) VALUES
  ('14:00', '2h', 'Airport Transfer', 'Narita International Terminal 3', 'scheduled', 'driver', 'plane', CURRENT_DATE),
  ('19:30', '1h', 'Evening Gala Drop-off', 'Imperial Hotel Main Entrance', 'waiting', 'driver', 'car', CURRENT_DATE),
  ('10:00', '1h', 'Review travel itinerary', 'Kyoto Autumn Season 2023', 'in-progress', 'secretary', 'map', CURRENT_DATE),
  ('16:30', '30m', 'Sign Q4 budget report', 'Office Lounge / Remote', 'pending', 'secretary', 'edit', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Investments
INSERT INTO investments (name, date_acquired, price, color) VALUES
  ('Original Painting', 'Acquired: Jan 2024', '$12,500', '#f59e0b'),
  ('Vintage Furniture', 'Acquired: Mar 2024', '$4,200', '#8b5cf6')
ON CONFLICT DO NOTHING;

-- Home Settings
INSERT INTO home_settings (setting_key, setting_value) VALUES
  ('lighting', '{"brightness": 80, "preset": "warm"}'),
  ('climate', '{"current_temp": 24, "target_temp": 22.5, "humidity": 45}'),
  ('security', '{"cameras_active": 4, "armed": true}'),
  ('air_purifier', '{"on": true, "mode": "auto"}'),
  ('smart_blinds', '{"on": false}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
