-- Phase 2: Canonical parent/child expense category tree (Version 2)
-- Safe to re-run.
-- Goal: keep legacy categories, group them under parent categories, and add new family health / personal shopping / education branches.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code_unique
  ON public.categories(code);

-- Ensure parent categories exist
INSERT INTO public.categories (name, name_vi, code, icon_name, color, fund_type, sort_order, parent_id)
VALUES
  ('Family Living', 'Sinh hoạt gia đình', 'P_SINH_HOAT_GIA_DINH', 'home', '#22c55e', 'household', 100, NULL),
  ('Mobility & Operations', 'Di chuyển & vận hành', 'P_DI_CHUYEN_VAN_HANH', 'car', '#0ea5e9', 'cash', 200, NULL),
  ('Family Health', 'Sức khỏe gia đình', 'P_SUC_KHOE_GIA_DINH', 'heart', '#ef4444', 'household', 300, NULL),
  ('Personal Shopping', 'Mua sắm cá nhân', 'P_MUA_SAM_CA_NHAN', 'shopping_bag', '#a855f7', 'household', 400, NULL),
  ('Education', 'Giáo dục', 'P_GIAO_DUC', 'school', '#f59e0b', 'household', 500, NULL),
  ('HR', 'Nhân sự', 'P_NHAN_SU', 'users', '#6366f1', 'salary', 600, NULL),
  ('External & Entertainment', 'Đối ngoại & giải trí', 'P_DOI_NGOAI_GIAI_TRI', 'gift', '#ec4899', 'pr', 700, NULL),
  ('Other', 'Khác', 'P_KHAC', 'file', '#94a3b8', 'cash', 999, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  icon_name = EXCLUDED.icon_name,
  color = EXCLUDED.color,
  fund_type = EXCLUDED.fund_type,
  sort_order = EXCLUDED.sort_order;

-- Ensure level-2 categories exist
INSERT INTO public.categories (name, name_vi, code, icon_name, color, fund_type, sort_order, parent_id)
SELECT * FROM (
  VALUES
    ('Food & Fruits', 'Thực phẩm & Trái cây', 'TIEN_CHO', 'shopping', '#f97316', 'household', 110, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),
    ('Utilities', 'Tiện ích (Điện/Nước/Gas)', 'DIEN_NUOC_GAS_NET', 'zap', '#3b82f6', 'household', 120, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),
    ('Household Items', 'Vật dụng gia đình', 'VAT_DUNG_GIA_DINH', 'home', '#8b5cf6', 'household', 130, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),
    ('Food Delivery', 'Đồ ăn gọi hàng', 'DO_AN_GOI', 'shopping', '#ef4444', 'household', 140, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),
    ('Kitchen', 'Chi bếp (Nguyên liệu)', 'CHI_BEP', 'kitchen', '#d97706', 'kitchen', 150, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),
    ('Subscriptions', 'Đăng ký dịch vụ', 'DANG_KY_DICH_VU', 'wifi', '#8b5cf6', 'cash', 160, (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')),

    ('Transport', 'Đi lại (Xăng/Cầu đường)', 'DI_LAI', 'car', '#22c55e', 'cash', 210, (SELECT id FROM public.categories WHERE code = 'P_DI_CHUYEN_VAN_HANH')),
    ('Maintenance & Repair', 'Sửa chữa & Bảo trì', 'SUA_CHUA_BAO_TRI', 'wrench', '#78716c', 'cash', 220, (SELECT id FROM public.categories WHERE code = 'P_DI_CHUYEN_VAN_HANH')),
    ('Travel', 'Du lịch (Vé bay/Khách sạn)', 'DU_LICH', 'plane', '#0ea5e9', 'pr', 230, (SELECT id FROM public.categories WHERE code = 'P_DI_CHUYEN_VAN_HANH')),

    ('Medicine', 'Thuốc men', 'C_THUOC_MEN', 'pill', '#f43f5e', 'household', 310, (SELECT id FROM public.categories WHERE code = 'P_SUC_KHOE_GIA_DINH')),
    ('Hospital / Treatment', 'Bệnh viện / khám chữa', 'C_BENH_VIEN_KHAM_CHUA', 'local_hospital', '#dc2626', 'household', 320, (SELECT id FROM public.categories WHERE code = 'P_SUC_KHOE_GIA_DINH')),

    ('Personal Shopping', 'Mua sắm cá nhân', 'C_MUA_SAM_CA_NHAN', 'shopping_bag', '#9333ea', 'household', 410, (SELECT id FROM public.categories WHERE code = 'P_MUA_SAM_CA_NHAN')),

    ('Education', 'Giáo dục', 'C_GIAO_DUC', 'school', '#f59e0b', 'household', 510, (SELECT id FROM public.categories WHERE code = 'P_GIAO_DUC')),

    ('Salary & HR', 'Lương & Nhân sự', 'LUONG_NHAN_SU', 'users', '#6366f1', 'salary', 610, (SELECT id FROM public.categories WHERE code = 'P_NHAN_SU')),

    ('PR & External', 'PR & Đối ngoại', 'PR_DOI_NGOAI', 'globe', '#14b8a6', 'pr', 710, (SELECT id FROM public.categories WHERE code = 'P_DOI_NGOAI_GIAI_TRI')),
    ('Entertainment & Gifts', 'Giải trí & Quà tặng', 'GIAI_TRI_QUA_TANG', 'gift', '#ec4899', 'pr', 720, (SELECT id FROM public.categories WHERE code = 'P_DOI_NGOAI_GIAI_TRI')),
    ('Auctions & Collections', 'Đấu giá & Sưu tầm', 'DAU_GIA_SUU_TAM', 'auction', '#f59e0b', 'pr', 730, (SELECT id FROM public.categories WHERE code = 'P_DOI_NGOAI_GIAI_TRI')),

    ('Other', 'Khác', 'KHAC', 'file', '#94a3b8', 'cash', 9990, (SELECT id FROM public.categories WHERE code = 'P_KHAC'))
) AS v(name, name_vi, code, icon_name, color, fund_type, sort_order, parent_id)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  icon_name = EXCLUDED.icon_name,
  color = EXCLUDED.color,
  fund_type = EXCLUDED.fund_type,
  sort_order = EXCLUDED.sort_order,
  parent_id = EXCLUDED.parent_id;

-- Ensure level-3 categories exist
INSERT INTO public.categories (name, name_vi, code, icon_name, color, fund_type, sort_order, parent_id)
SELECT * FROM (
  VALUES
    ('Medicine for Grandfather', 'Ông', 'THUOC_ONG', 'pill', '#fb7185', 'household', 311, (SELECT id FROM public.categories WHERE code = 'C_THUOC_MEN')),
    ('Medicine for Anh Quang', 'Anh Quang', 'THUOC_ANH_QUANG', 'pill', '#fb7185', 'household', 312, (SELECT id FROM public.categories WHERE code = 'C_THUOC_MEN')),
    ('Medicine for Jennie', 'Jennie', 'THUOC_JENNIE', 'pill', '#fb7185', 'household', 313, (SELECT id FROM public.categories WHERE code = 'C_THUOC_MEN')),
    ('Medicine for ChipTun', 'ChipTun', 'THUOC_CHIPTUN', 'pill', '#fb7185', 'household', 314, (SELECT id FROM public.categories WHERE code = 'C_THUOC_MEN')),

    ('Hospital for Grandfather', 'Ông', 'KHAM_CHUA_ONG', 'local_hospital', '#f87171', 'household', 321, (SELECT id FROM public.categories WHERE code = 'C_BENH_VIEN_KHAM_CHUA')),
    ('Hospital for Anh Quang', 'Anh Quang', 'KHAM_CHUA_ANH_QUANG', 'local_hospital', '#f87171', 'household', 322, (SELECT id FROM public.categories WHERE code = 'C_BENH_VIEN_KHAM_CHUA')),
    ('Hospital for Jennie', 'Jennie', 'KHAM_CHUA_JENNIE', 'local_hospital', '#f87171', 'household', 323, (SELECT id FROM public.categories WHERE code = 'C_BENH_VIEN_KHAM_CHUA')),
    ('Hospital for ChipTun', 'ChipTun', 'KHAM_CHUA_CHIPTUN', 'local_hospital', '#f87171', 'household', 324, (SELECT id FROM public.categories WHERE code = 'C_BENH_VIEN_KHAM_CHUA')),

    ('Shopping for Grandfather', 'Ông', 'MUA_SAM_ONG', 'shopping_bag', '#c084fc', 'household', 411, (SELECT id FROM public.categories WHERE code = 'C_MUA_SAM_CA_NHAN')),
    ('Shopping for Anh Quang', 'Anh Quang', 'MUA_SAM_ANH_QUANG', 'shopping_bag', '#c084fc', 'household', 412, (SELECT id FROM public.categories WHERE code = 'C_MUA_SAM_CA_NHAN')),
    ('Shopping for Jennie', 'Jennie', 'MUA_SAM_JENNIE', 'shopping_bag', '#c084fc', 'household', 413, (SELECT id FROM public.categories WHERE code = 'C_MUA_SAM_CA_NHAN')),
    ('Shopping for ChipTun', 'ChipTun', 'MUA_SAM_CHIPTUN', 'shopping_bag', '#c084fc', 'household', 414, (SELECT id FROM public.categories WHERE code = 'C_MUA_SAM_CA_NHAN')),

    ('Education for Jennie', 'Jennie', 'GIAO_DUC_JENNIE', 'school', '#fbbf24', 'household', 511, (SELECT id FROM public.categories WHERE code = 'C_GIAO_DUC')),
    ('Education for ChipTun', 'ChipTun', 'GIAO_DUC_CHIPTUN', 'school', '#fbbf24', 'household', 512, (SELECT id FROM public.categories WHERE code = 'C_GIAO_DUC')),
    ('Education for Khanh Linh / Staff', 'Khánh Linh / Nhân viên', 'GIAO_DUC_KHANH_LINH_NHAN_VIEN', 'school', '#fbbf24', 'household', 513, (SELECT id FROM public.categories WHERE code = 'C_GIAO_DUC')),
    ('School fees for ChipTun', 'Học phí / trường học ChipTun', 'HOC_PHI_TRUONG_HOC_CHIPTUN', 'account_balance', '#f59e0b', 'household', 514, (SELECT id FROM public.categories WHERE code = 'C_GIAO_DUC'))
) AS v(name, name_vi, code, icon_name, color, fund_type, sort_order, parent_id)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_vi = EXCLUDED.name_vi,
  icon_name = EXCLUDED.icon_name,
  color = EXCLUDED.color,
  fund_type = EXCLUDED.fund_type,
  sort_order = EXCLUDED.sort_order,
  parent_id = EXCLUDED.parent_id;

-- Re-parent legacy/existing categories into the new tree.
UPDATE public.categories
SET parent_id = (SELECT id FROM public.categories WHERE code = 'P_SINH_HOAT_GIA_DINH')
WHERE code IN ('TIEN_CHO', 'DIEN_NUOC_GAS_NET', 'VAT_DUNG_GIA_DINH', 'DO_AN_GOI', 'CHI_BEP', 'DANG_KY_DICH_VU');

UPDATE public.categories
SET parent_id = (SELECT id FROM public.categories WHERE code = 'P_DI_CHUYEN_VAN_HANH')
WHERE code IN ('DI_LAI', 'SUA_CHUA_BAO_TRI', 'DU_LICH');

UPDATE public.categories
SET parent_id = (SELECT id FROM public.categories WHERE code = 'P_NHAN_SU')
WHERE code IN ('LUONG_NHAN_SU');

UPDATE public.categories
SET parent_id = (SELECT id FROM public.categories WHERE code = 'P_DOI_NGOAI_GIAI_TRI')
WHERE code IN ('PR_DOI_NGOAI', 'GIAI_TRI_QUA_TANG', 'DAU_GIA_SUU_TAM');

UPDATE public.categories
SET parent_id = (SELECT id FROM public.categories WHERE code = 'P_KHAC')
WHERE code IN ('KHAC');

-- Optional verification query:
-- SELECT c1.name_vi AS parent, c2.name_vi AS child, c2.code
-- FROM public.categories c2
-- LEFT JOIN public.categories c1 ON c1.id = c2.parent_id
-- ORDER BY COALESCE(c1.sort_order, c2.sort_order), c2.sort_order, c2.id;
