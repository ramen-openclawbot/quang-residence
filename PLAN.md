# ZenHome App — Implementation Plan v2.0

## Tổng quan bài toán

ZenHome chuyển từ ứng dụng dashboard tĩnh sang hệ thống quản lý tài chính gia đình đa người dùng, giải quyết 3 vấn đề cốt lõi: (1) thất thoát do nhập liệu thủ công bằng Excel không đầy đủ, (2) không có hệ thống kiểm soát thu-chi real-time, (3) staff quá tải công việc chồng chéo dẫn đến sót việc.

---

## 1. Hệ thống Login & Phân quyền

### 1.1 Phương thức đăng nhập

**Đề xuất: Supabase Auth với Magic Link (OTP qua email)**

Lý do chọn Magic Link thay vì password truyền thống: staff sử dụng chủ yếu trên điện thoại, Magic Link giảm ma sát đăng nhập (không cần nhớ mật khẩu), bảo mật hơn vì mỗi link chỉ dùng 1 lần. Backup option: hỗ trợ thêm đăng nhập bằng số điện thoại (Supabase hỗ trợ SMS OTP).

Sau đăng nhập lần đầu, duy trì session bằng refresh token — staff không cần đăng nhập lại thường xuyên (session tồn tại 30 ngày).

### 1.2 Bảng phân quyền

| Vai trò | Tên | Quyền xem | Quyền nhập/sửa | Quyền duyệt |
|---------|-----|-----------|-----------------|-------------|
| **owner** | Mr. Quang | Tất cả dữ liệu, tổng hợp, báo cáo | Không (chỉ xem) | Duyệt chi, duyệt task |
| **secretary** | Thuỷ | Tất cả quỹ, tất cả giao dịch, task của mình + task giao cho team | Nhập thu/chi tất cả quỹ, tạo task cho team, quản lý đấu giá, sổ tiết kiệm/vay | Không |
| **housekeeper** | Trang | Chi tiêu gia đình do mình nhập, task của mình | Nhập chi tiêu mua sắm/gia đình, báo cáo tình trạng nhà, lịch con | Không |
| **driver** | Trường | Chi tiêu bếp do mình nhập, task lái xe | Nhập chi tiêu bếp, báo cáo hành trình | Không |

### 1.3 Cơ chế bảo mật (Row Level Security)

Mỗi bản ghi giao dịch có trường `created_by` (user_id). RLS policy:

- **owner**: `SELECT *` trên tất cả bảng, `UPDATE` trường `status` (duyệt/từ chối)
- **secretary**: `SELECT *` trên tất cả bảng giao dịch + task, `INSERT/UPDATE` trên giao dịch + task
- **housekeeper/driver**: `SELECT` chỉ bản ghi có `created_by = auth.uid()` hoặc `assigned_to = auth.uid()`, `INSERT` cho bản ghi mới

---

## 2. Luồng sử dụng chính (User Flows)

### 2.1 Flow nhập liệu thu/chi bằng Bank Slip (tất cả staff dùng chung)

```
Staff mở app
  → Nhấn nút [+ Giao dịch mới]
  → Chọn: [Chi] hoặc [Thu]
  → Chụp ảnh / Upload ảnh bank slip
  → Hệ thống OCR tự động quét:
      ├── Số tiền (VND 1,970,000)
      ├── Người nhận (CONG TY TNHH TRAI CAY DAI PHUC)
      ├── Nội dung chuyển khoản / Lời nhắn ("1 thung man")
      ├── Ngày giao dịch (11 thg 3, 2026 lúc 9:43)
      ├── Mã giao dịch (FT26070907872093)
      └── Ngân hàng (Techcombank → MB Bank)
  → Hiển thị kết quả OCR để staff xác nhận/chỉnh sửa
  → Phân loại tự động dựa trên nội dung:
      ├── Nếu nội dung rõ ràng → AI phân loại tự động
      │   (VD: "1 thung man" → Thực phẩm / Trái cây)
      └── Nếu nội dung không rõ → Hiện picker "Chọn danh mục"
  → Staff chọn quỹ (Quỹ PR / Quỹ tiền mặt / Quỹ lương / Chi gia đình / Chi bếp)
  → Nhấn [Gửi] → Giao dịch được lưu + ảnh gốc được lưu
  → Mr. Quang nhận notification (nếu vượt ngưỡng hoặc cần duyệt)
```

### 2.2 Flow Mr. Quang (Owner)

```
Mở app → Dashboard tổng quan (giống hiện tại nhưng dữ liệu real-time)
  ├── Home: Tóm tắt thu/chi hôm nay, tuần, tháng
  ├── Wealth: Biểu đồ chi tiêu, so sánh budget, đối chiếu quỹ
  │   └── Drill-down vào từng quỹ → xem từng giao dịch + ảnh chứng từ
  ├── Ambiance: Quản lý nhà thông minh (giữ nguyên)
  ├── Agenda: Xem tất cả task của team, trạng thái
  └── Notifications:
      ├── Giao dịch mới cần duyệt
      ├── Tóm tắt chi tiêu cuối ngày (auto-generated)
      └── Nhắc lịch sổ tiết kiệm/vay đến hạn
```

### 2.3 Flow Thuỷ (Secretary)

```
Mở app → Dashboard thư ký
  ├── [Quỹ] Quản lý 3 quỹ:
  │   ├── Quỹ PR — thu/chi, đối chiếu, tổng kết tháng
  │   ├── Quỹ tiền mặt — thu/chi, đối chiếu
  │   └── Quỹ lương — thu/chi
  │   └── Mỗi quỹ: Nút [+ Nhập giao dịch] → flow bank slip
  │
  ├── [Việc hàng ngày] Todo list pop-up tasks:
  │   ├── Tạo task mới (mua đồ, đặt vé, visa, khách sạn...)
  │   ├── Giao task cho Trang hoặc Trường
  │   ├── Theo dõi tiến độ
  │   └── Nhắc nhở tự động khi task quá hạn
  │
  ├── [Đấu giá] Quản lý auctions:
  │   ├── Thêm mục đấu giá mới
  │   ├── Timeline: Đăng ký → Đấu giá → Thanh toán → Vận chuyển
  │   └── Trạng thái từng bước
  │
  ├── [Tiết kiệm/Vay] Sổ tiết kiệm & vay:
  │   ├── Danh sách sổ + ngân hàng + lãi suất
  │   ├── Nhắc hạn đến hạn
  │   └── So sánh phương án
  │
  └── [Tổng kết] Auto-report:
      ├── Tổng kết ngày (auto push notification cho Mr. Quang)
      └── Tổng kết tháng (cho từng quỹ)
```

### 2.4 Flow Trang (Housekeeper)

```
Mở app → Dashboard quản gia
  ├── [Chi tiêu gia đình] Nhập chi hàng ngày:
  │   ├── Nút [+ Nhập giao dịch] → flow bank slip
  │   ├── Phân loại: Thực phẩm / Đồ dùng / Đồ ăn gọi / Khác
  │   └── Tóm tắt chi tiêu hôm nay / tuần / tháng
  │
  ├── [Nhà cửa] Quản lý sửa chữa & bảo trì:
  │   ├── Báo hỏng hóc (chụp ảnh + mô tả)
  │   ├── Trạng thái: Chờ sửa → Đang sửa → Hoàn thành
  │   └── Lịch sử bảo trì
  │
  ├── [Chuột & ChipTun] Lịch sinh hoạt:
  │   ├── Lịch học
  │   ├── Lịch khám sức khỏe
  │   └── Các hoạt động khác
  │
  └── [Báo cáo] Daily report → auto push cho Mr. Quang & Thuỷ
```

### 2.5 Flow Trường (Driver)

```
Mở app → Dashboard lái xe
  ├── [Lịch trình] Lịch lái xe hôm nay:
  │   ├── Danh sách chuyến (gán bởi Thuỷ hoặc Mr. Quang)
  │   ├── Nhấn "Bắt đầu" / "Hoàn thành"
  │   └── Lịch sử chuyến
  │
  ├── [Chi tiêu bếp] Nhập chi bếp:
  │   ├── Nút [+ Nhập giao dịch] → flow bank slip
  │   ├── Phân loại: Nguyên liệu / Gas / Dụng cụ / Khác
  │   └── Tóm tắt chi tiêu bếp
  │
  └── [Nhập liệu] Kiểm tra & nhập số liệu (task do Thuỷ giao)
```

---

## 3. Kiến trúc kỹ thuật

### 3.1 Tech Stack

| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
| Frontend | Next.js 15 (App Router) | SSR, tối ưu SEO, routing linh hoạt |
| UI | React + Inline styles (hiện tại) → có thể migrate Tailwind sau | Giữ nguyên design system ZenHome |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) | All-in-one BaaS, real-time subscriptions |
| OCR | Google Cloud Vision API hoặc Supabase Edge Function + Tesseract | Nhận diện bank slip tiếng Việt |
| AI Categorization | OpenAI GPT-4o-mini (via Edge Function) | Phân loại giao dịch từ nội dung chuyển khoản |
| Image Storage | Supabase Storage (S3-compatible) | Lưu ảnh bank slip gốc làm chứng từ |
| Hosting | Vercel | Auto-deploy từ GitHub, CDN global |
| Push Notification | Supabase Realtime + Web Push API | Nhắc nhở staff, thông báo cho Mr. Quang |

### 3.2 Database Schema (mở rộng từ schema hiện tại)

**Bảng mới cần tạo:**

```
profiles                     ← User profiles & roles
├── id (UUID, FK auth.users)
├── full_name
├── role (owner/secretary/housekeeper/driver)
├── avatar_url
├── phone
└── created_at

funds                        ← Các quỹ (PR, tiền mặt, lương, gia đình, bếp)
├── id
├── name
├── fund_type (pr/cash/salary/household/kitchen)
├── current_balance
├── budget_monthly
└── managed_by (FK profiles)

transactions                 ← Giao dịch thu/chi (BẢNG CHÍNH)
├── id
├── type (income/expense)
├── amount
├── currency (VND)
├── fund_id (FK funds)
├── category_id (FK categories)
├── description (nội dung chuyển khoản)
├── recipient_name
├── bank_name
├── bank_account
├── transaction_code (mã giao dịch ngân hàng)
├── transaction_date
├── slip_image_url (ảnh bank slip gốc)
├── ocr_raw_data (JSONB - kết quả OCR thô)
├── status (pending/approved/rejected)
├── approved_by (FK profiles, Mr. Quang)
├── approved_at
├── created_by (FK profiles)
├── created_at
└── notes

categories                   ← Danh mục chi tiêu
├── id
├── name (Thực phẩm, Trái cây, Điện nước, Xăng dầu...)
├── parent_id (FK categories, cho phân cấp)
├── icon_name
├── color
└── fund_type (liên kết mặc định với quỹ nào)

tasks                        ← Task management
├── id
├── title
├── description
├── task_type (popup/auction/maintenance/schedule/driving)
├── priority (low/medium/high/urgent)
├── status (pending/in_progress/done/cancelled)
├── due_date
├── assigned_to (FK profiles)
├── created_by (FK profiles)
├── completed_at
└── created_at

task_comments                ← Cập nhật tiến độ task
├── id
├── task_id (FK tasks)
├── user_id (FK profiles)
├── content
├── image_url
└── created_at

auctions                    ← Quản lý đấu giá (Thuỷ)
├── id
├── item_name
├── auction_house
├── auction_date
├── registration_deadline
├── status (tracking/registered/bidding/won/lost/paid/shipping/received)
├── deposit_amount
├── final_price
├── shipping_status
├── notes
├── created_by
└── created_at

savings_loans               ← Sổ tiết kiệm & vay (Thuỷ)
├── id
├── type (savings/loan)
├── bank_name
├── account_number
├── principal_amount
├── interest_rate
├── start_date
├── maturity_date
├── auto_renew
├── status (active/matured/closed)
├── notes
└── created_at

home_maintenance            ← Bảo trì nhà (Trang)
├── id
├── title
├── description
├── location_in_house
├── image_url
├── status (reported/scheduled/in_progress/completed)
├── contractor_name
├── estimated_cost
├── actual_cost
├── completed_at
└── created_at

family_schedule             ← Lịch gia đình (Trang)
├── id
├── title
├── schedule_type (school/health/activity/other)
├── family_member (Chuột/ChipTun/other)
├── date
├── time
├── recurring (once/daily/weekly/monthly)
├── notes
└── created_at

driving_trips               ← Chuyến xe (Trường)
├── id
├── title
├── pickup_location
├── dropoff_location
├── scheduled_time
├── actual_start
├── actual_end
├── status (scheduled/in_progress/completed/cancelled)
├── assigned_to (FK profiles)
├── created_by
└── notes

daily_reports               ← Báo cáo tự động cuối ngày
├── id
├── report_date
├── user_id (FK profiles)
├── report_type (daily_expense/monthly_summary/fund_reconciliation)
├── content (JSONB)
├── sent_to (FK profiles[])
└── created_at
```

### 3.3 OCR Pipeline (Bank Slip Scanner)

Dựa trên mẫu bank slip đã xem (Techcombank, MB Bank), hệ thống cần extract:

```
Input: Ảnh bank slip (JPG/PNG)
  ↓
Step 1: Upload ảnh lên Supabase Storage
  ↓
Step 2: Gọi OCR API (Supabase Edge Function)
  ├── Option A: Google Cloud Vision API (chính xác nhất cho tiếng Việt)
  ├── Option B: Tesseract.js (miễn phí, chạy on-device)
  └── Option C: OpenAI Vision API (GPT-4o) — vừa OCR vừa phân loại
  ↓
Step 3: Parse kết quả OCR → extract fields:
  ├── amount: regex "VND [\d,.]+" hoặc số tiền lớn
  ├── recipient: text sau "Tới" hoặc "Người nhận"
  ├── bank_name: detect logo (Techcombank, MB, Vietcombank...)
  ├── bank_account: regex "\d{4,}"
  ├── description: text sau "Lời nhắn" hoặc "Nội dung"
  ├── date: text sau "Ngày thực hiện"
  └── transaction_code: text sau "Mã giao dịch" (pattern FT/VCB/...)
  ↓
Step 4: AI categorize từ description:
  ├── "1 thung man" → Category: Thực phẩm > Trái cây
  ├── "tien dien thang 3" → Category: Tiện ích > Điện
  └── Nếu không nhận diện được → prompt user chọn category
  ↓
Step 5: Trả kết quả về app → staff confirm → save transaction
```

**Đề xuất tối ưu nhất cho OCR: Dùng OpenAI GPT-4o Vision (Option C)**

Lý do: Một API call duy nhất vừa đọc text (OCR) vừa phân loại (AI categorization) vừa extract structured data. Prompt:

```
"Analyze this Vietnamese bank transfer slip image.
Extract: amount, recipient_name, bank_name, account_number,
description/note, transaction_date, transaction_code.
Also categorize the expense based on the description.
Return as JSON."
```

Chi phí ước tính: ~$0.01/ảnh → 100 giao dịch/tháng ≈ $1/tháng.

---

## 4. Chiến lược dữ liệu

### 4.1 Giai đoạn 1: Triển khai staff nhập liệu (BÂY GIỜ)

Cho staff bắt đầu nhập liệu hàng ngày ngay từ bây giờ. Dữ liệu mới sẽ được ghi vào Supabase theo schema ở trên. Mỗi giao dịch đều có ảnh chứng từ gốc → không thể gian lận.

### 4.2 Giai đoạn 2: Audit dữ liệu Excel cũ (SONG SONG)

- Import file Excel cũ vào bảng `transactions_legacy` (bảng tạm)
- So sánh, đối chiếu, validate
- Đánh dấu các bản ghi thiếu chứng từ
- Tạo báo cáo audit cho Mr. Quang review
- Sau khi Mr. Quang approve → migrate vào bảng `transactions` chính với flag `source = 'legacy_import'`

### 4.3 Giai đoạn 3: Nối tiếp dữ liệu (SAU KHI AUDIT XONG)

- Dữ liệu cũ (legacy) + dữ liệu mới (daily input) → merge thành timeline liên tục
- Dashboard Mr. Quang hiển thị toàn bộ lịch sử thu/chi

---

## 5. Phân đoạn phát triển (Roadmap)

### Phase 1 — Foundation (Tuần 1-2)
- [ ] Setup Supabase Auth (magic link) + profiles table
- [ ] Tạo database schema đầy đủ (migration SQL)
- [ ] Build login screen + role-based routing
- [ ] Build transaction input form (không OCR, nhập tay trước)
- [ ] Build category picker
- [ ] Mr. Quang dashboard hiển thị dữ liệu real từ Supabase

### Phase 2 — Bank Slip OCR (Tuần 3)
- [ ] Setup Supabase Storage bucket cho ảnh bank slip
- [ ] Build camera/upload UI component
- [ ] Integrate OCR API (GPT-4o Vision hoặc Google Vision)
- [ ] Build OCR result confirmation screen
- [ ] Auto-categorization từ nội dung chuyển khoản

### Phase 3 — Staff Screens (Tuần 4-5)
- [ ] Thuỷ: Quản lý quỹ + tổng kết + task management
- [ ] Trang: Chi tiêu gia đình + nhà cửa + lịch gia đình
- [ ] Trường: Chi bếp + lịch xe
- [ ] Task system: tạo / giao / theo dõi / nhắc nhở

### Phase 4 — Advanced Features (Tuần 6-7)
- [ ] Đấu giá management (Thuỷ)
- [ ] Sổ tiết kiệm/vay + nhắc hạn (Thuỷ)
- [ ] Home maintenance tracking (Trang)
- [ ] Auto daily reports + push notifications
- [ ] Monthly fund reconciliation reports

### Phase 5 — Data Migration & Polish (Tuần 8)
- [ ] Import Excel legacy data
- [ ] Audit tools cho Mr. Quang
- [ ] Performance optimization
- [ ] PWA support (install trên phone như native app)

---

## 6. Cấu trúc thư mục dự kiến

```
quang-residence/
├── app/
│   ├── layout.jsx                    ← Root layout
│   ├── page.jsx                      ← Landing / redirect theo role
│   ├── login/page.jsx                ← Login (magic link)
│   ├── owner/                        ← Mr. Quang screens
│   │   ├── page.jsx                  ← Dashboard tổng quan
│   │   ├── wealth/page.jsx           ← Chi tiết tài chính
│   │   ├── ambiance/page.jsx         ← Smart home
│   │   ├── agenda/page.jsx           ← Tất cả tasks
│   │   └── transactions/[id]/page.jsx← Chi tiết giao dịch + ảnh chứng từ
│   ├── secretary/                    ← Thuỷ screens
│   │   ├── page.jsx                  ← Dashboard thư ký
│   │   ├── funds/[fundId]/page.jsx   ← Chi tiết quỹ
│   │   ├── tasks/page.jsx            ← Task management
│   │   ├── auctions/page.jsx         ← Đấu giá
│   │   └── savings/page.jsx          ← Tiết kiệm/vay
│   ├── housekeeper/                  ← Trang screens
│   │   ├── page.jsx                  ← Dashboard quản gia
│   │   ├── expenses/page.jsx         ← Chi tiêu gia đình
│   │   ├── maintenance/page.jsx      ← Bảo trì nhà
│   │   └── schedule/page.jsx         ← Lịch gia đình
│   ├── driver/                       ← Trường screens
│   │   ├── page.jsx                  ← Dashboard lái xe
│   │   ├── trips/page.jsx            ← Lịch chuyến xe
│   │   └── kitchen/page.jsx          ← Chi tiêu bếp
│   └── api/
│       ├── ocr/route.js              ← OCR endpoint
│       └── reports/route.js          ← Generate reports
├── components/
│   ├── Dashboard.jsx                 ← Owner dashboard (hiện tại)
│   ├── TransactionForm.jsx           ← Form nhập giao dịch
│   ├── BankSlipScanner.jsx           ← Camera + OCR
│   ├── CategoryPicker.jsx            ← Chọn danh mục
│   ├── TaskManager.jsx               ← Task CRUD
│   └── shared/                       ← Shared UI components
├── lib/
│   ├── supabase.js                   ← Supabase client
│   ├── ocr.js                        ← OCR processing
│   └── auth.js                       ← Auth helpers + middleware
├── supabase/
│   ├── schema.sql                    ← Full database schema
│   ├── seed.sql                      ← Initial data
│   └── functions/                    ← Edge Functions
│       └── process-bank-slip/        ← OCR + categorize
└── middleware.js                      ← Auth guard + role routing
```

---

## 7. Thông tin cần anh Quang quyết định

1. **Email staff:** Cần email của Thuỷ, Trang, Trường để setup tài khoản login
2. **Danh mục chi tiêu:** Anh muốn phân loại chi tiêu theo các nhóm nào? Em đề xuất sơ bộ:
   - Thực phẩm (trái cây, rau, thịt, đồ ăn gọi...)
   - Tiện ích (điện, nước, internet, gas...)
   - Vật dụng gia đình
   - Đi lại (xăng, phí cầu đường, bảo dưỡng xe...)
   - Giải trí & Quà tặng
   - Đấu giá & Sưu tầm
   - Lương & Nhân sự
   - PR & Đối ngoại
   - Sửa chữa & Bảo trì nhà
   - Khác
3. **OCR API:** Em đề xuất dùng GPT-4o Vision ($1/tháng cho ~100 giao dịch). Anh có OpenAI API key không, hay em setup cho?
4. **Ngưỡng duyệt chi:** Giao dịch trên bao nhiêu VND cần Mr. Quang duyệt? (VD: > 5,000,000 VND)
5. **Số quỹ:** Ngoài 3 quỹ Thuỷ quản lý (PR, tiền mặt, lương), có thêm quỹ nào không?
6. **File Excel hiện tại:** Khi sẵn sàng, anh gửi file Excel cũ để em phân tích cấu trúc và lên kế hoạch import

---

## 8. Chi phí ước tính hàng tháng

| Service | Chi phí |
|---------|---------|
| Supabase (Free tier) | $0 (đủ cho 4 users, 500MB storage) |
| Vercel (Free tier) | $0 |
| OCR/AI (GPT-4o Vision) | ~$1-5/tháng |
| **Tổng** | **~$1-5/tháng** |

Nếu scale lên (nhiều giao dịch hơn, nhiều ảnh hơn): Supabase Pro $25/tháng, Vercel Pro $20/tháng.
