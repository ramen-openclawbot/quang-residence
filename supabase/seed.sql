-- =============================================
-- ZenHome v2.0 — Seed Data
-- Safe to re-run after schema.sql / storage.sql
-- =============================================

-- Categories
INSERT INTO public.categories (name, name_vi, icon_name, color, fund_type, sort_order)
VALUES
  ('Food & Fruits', 'Thực phẩm & Trái cây', 'shopping', '#f97316', 'household', 1),
  ('Utilities', 'Tiện ích (Điện/Nước/Gas)', 'zap', '#3b82f6', 'household', 2),
  ('Household Items', 'Vật dụng gia đình', 'home', '#8b5cf6', 'household', 3),
  ('Food Delivery', 'Đồ ăn gọi hàng', 'shopping', '#ef4444', 'household', 4),
  ('Transport', 'Đi lại (Xăng/Cầu đường)', 'car', '#22c55e', 'cash', 5),
  ('Entertainment & Gifts', 'Giải trí & Quà tặng', 'gift', '#ec4899', 'pr', 6),
  ('Auctions & Collections', 'Đấu giá & Sưu tầm', 'auction', '#f59e0b', 'pr', 7),
  ('Salary & HR', 'Lương & Nhân sự', 'users', '#6366f1', 'salary', 8),
  ('PR & External', 'PR & Đối ngoại', 'globe', '#14b8a6', 'pr', 9),
  ('Maintenance & Repair', 'Sửa chữa & Bảo trì', 'wrench', '#78716c', 'cash', 10),
  ('Travel', 'Du lịch (Vé bay/Khách sạn)', 'plane', '#0ea5e9', 'pr', 11),
  ('Kitchen', 'Chi bếp (Nguyên liệu)', 'kitchen', '#d97706', 'kitchen', 12),
  ('Subscriptions', 'Đăng ký dịch vụ', 'wifi', '#8b5cf6', 'cash', 13),
  ('Other', 'Khác', 'file', '#94a3b8', 'cash', 99)
ON CONFLICT DO NOTHING;

-- Funds (5 quỹ chính — unique on fund_type, safe to re-run)
INSERT INTO public.funds (name, fund_type, current_balance, budget_monthly)
VALUES
  ('Quỹ PR',        'pr',        0, 50000000),
  ('Quỹ tiền mặt', 'cash',      0, 30000000),
  ('Quỹ lương',     'salary',    0, 20000000),
  ('Chi gia đình',  'household', 0, 15000000),
  ('Chi bếp',       'kitchen',   0, 10000000)
ON CONFLICT (fund_type) DO UPDATE SET
  budget_monthly = EXCLUDED.budget_monthly;

-- Home settings used by current UI
INSERT INTO public.home_settings (setting_key, setting_value)
VALUES
  ('lighting', '{"brightness": 80, "preset": "warm"}'::jsonb),
  ('climate', '{"current_temp": 24, "target_temp": 22.5, "humidity": 45}'::jsonb),
  ('security', '{"cameras_active": 4, "armed": true}'::jsonb),
  ('air_purifier', '{"on": true, "mode": "auto"}'::jsonb),
  ('smart_blinds', '{"on": false}'::jsonb)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();
