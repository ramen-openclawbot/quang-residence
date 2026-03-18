-- Phase 1.1: Canonical expense category codes for analytics
-- Run in Supabase SQL editor (safe to re-run)

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Backfill code for existing default categories by Vietnamese label
UPDATE public.categories SET code = 'TIEN_CHO'              WHERE code IS NULL AND lower(name_vi) = lower('Thực phẩm & Trái cây');
UPDATE public.categories SET code = 'DIEN_NUOC_GAS_NET'     WHERE code IS NULL AND lower(name_vi) = lower('Tiện ích (Điện/Nước/Gas)');
UPDATE public.categories SET code = 'VAT_DUNG_GIA_DINH'     WHERE code IS NULL AND lower(name_vi) = lower('Vật dụng gia đình');
UPDATE public.categories SET code = 'DO_AN_GOI'             WHERE code IS NULL AND lower(name_vi) = lower('Đồ ăn gọi hàng');
UPDATE public.categories SET code = 'DI_LAI'                WHERE code IS NULL AND lower(name_vi) = lower('Đi lại (Xăng/Cầu đường)');
UPDATE public.categories SET code = 'GIAI_TRI_QUA_TANG'     WHERE code IS NULL AND lower(name_vi) = lower('Giải trí & Quà tặng');
UPDATE public.categories SET code = 'DAU_GIA_SUU_TAM'       WHERE code IS NULL AND lower(name_vi) = lower('Đấu giá & Sưu tầm');
UPDATE public.categories SET code = 'LUONG_NHAN_SU'         WHERE code IS NULL AND lower(name_vi) = lower('Lương & Nhân sự');
UPDATE public.categories SET code = 'PR_DOI_NGOAI'          WHERE code IS NULL AND lower(name_vi) = lower('PR & Đối ngoại');
UPDATE public.categories SET code = 'SUA_CHUA_BAO_TRI'      WHERE code IS NULL AND lower(name_vi) = lower('Sửa chữa & Bảo trì');
UPDATE public.categories SET code = 'DU_LICH'               WHERE code IS NULL AND lower(name_vi) = lower('Du lịch (Vé bay/Khách sạn)');
UPDATE public.categories SET code = 'CHI_BEP'               WHERE code IS NULL AND lower(name_vi) = lower('Chi bếp (Nguyên liệu)');
UPDATE public.categories SET code = 'DANG_KY_DICH_VU'       WHERE code IS NULL AND lower(name_vi) = lower('Đăng ký dịch vụ');
UPDATE public.categories SET code = 'KHAC'                  WHERE code IS NULL AND lower(name_vi) = lower('Khác');

-- Fill remaining nulls with deterministic fallback from id
UPDATE public.categories
SET code = 'CAT_' || id
WHERE code IS NULL OR trim(code) = '';

-- Enforce uniqueness for analytics key
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code_unique
  ON public.categories(code);

-- Optional query example:
-- SELECT c.code, c.name_vi, SUM(t.amount) as total
-- FROM transactions t
-- JOIN categories c ON c.id = t.category_id
-- WHERE t.type = 'expense'
--   AND t.transaction_date >= '2026-03-01'::timestamptz
--   AND t.transaction_date <  '2026-04-01'::timestamptz
-- GROUP BY c.code, c.name_vi
-- ORDER BY total DESC;
