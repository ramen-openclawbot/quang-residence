# HANDOFF.md — ZenHome App

_Last updated: 2026-03-16 09:45 GMT+7_

## Repo
- Local path: `/Users/mrquang/dev app/zenhome-app`
- GitHub: `https://github.com/ramen-openclawbot/quang-residence.git`
- Branch: `main`
- Current pushed commit: `82edd6a`

## Current product state
ZenHome is now in a **product-hardening + CRUD-completion** phase, not an auth/firefighting phase.
It currently has:
- working **email + password auth**
- owner-only protected admin APIs
- temporary-password user creation
- owner-side role management
- owner-side password reset for users
- self password update flow for the logged-in owner
- redesigned dashboards for all 4 roles
- English-first UI direction with a calmer “Zen house / estate console” feel
- mobile receipt upload fixed to allow selecting from device library
- owner Home `Active funds` now uses a more meaningful realtime rule: counts only funds with `current_balance > 0`, instead of counting every row in `funds`

## Auth / account status
### Current auth model
- Login uses `signInWithPassword()`
- Magic-link login was removed as the main flow
- New users are created with a **temporary password**
- Owner can reset a user password from Account Management
- Owner can change their own password from Security panel

### Admin protection
Admin routes now require a valid **logged-in owner session** via bearer token.
Protected routes:
- `/api/admin/create-user`
- `/api/admin/update-role`
- `/api/admin/reset-password`

### Shared server auth helper
- `app/api/admin/_auth.js`

## Test account / manual validation
- Test user used during development: `tam@bmq.vn`
- Login confirmed working
- Roles were manually changed in Supabase during testing to preview role-specific UIs

## Database / Supabase status
Supabase scripts were reconciled and aligned with current codebase:
- `supabase/schema.sql`
- `supabase/storage.sql`
- `supabase/seed.sql`

### Important DB state
- scripts are intended to be **rerunnable / idempotent**
- RLS/policy setup was updated toward safer re-run behavior
- storage bucket `bank-slips` is defined
- `notifications` and `daily_reports` were aligned with code expectations
- `tasks` table now has `updated_at` + auto-update trigger (required by cron query)
- `daily_reports` columns are `report_type` + `content` (NOT `summary`/`data`)
- `funds` table now has `UNIQUE` constraint on `fund_type` and `name`
  → seed.sql uses `ON CONFLICT (fund_type) DO UPDATE` — **safe to re-run, no duplicates**

### ⚠️ If Monthly Budget shows 250,000,000đ (doubled)
Cause: seed.sql was run twice before the UNIQUE constraint existed → 10 rows instead of 5.
Fix (run once in Supabase SQL Editor):
```sql
DELETE FROM funds
WHERE id NOT IN (
  SELECT MIN(id) FROM funds GROUP BY fund_type
);
```

## Major UI / product work completed
### Owner
Owner now has:
- live-data dashboard summaries
- notification center wiring
- settings panels with real interactions
- working **Account Management** panel
- create user flow in UI
- role update flow in UI
- reset-password flow in UI
- self password update flow in Security
- calmer “Zen estate” visual pass
- simplified Home screen with **wealth snapshot removed** for a cleaner main view

Key owner-related commits:
- `3daf809` — account management panel + role updates
- `22ee13c` — owner interactions + settings panels
- `9690e23` — owner zen-estate visual refinement
- `74a49ac` — require owner session for admin APIs
- `7f6d4f7` — password reset + self password update
- `8b42306` — remove wealth snapshot from owner Home for cleaner UI
- `673ce71` — change `Active funds` to count only funds with positive balance
- `52a725f` — add balance fallback and handoff updates
- `c77b65b` — audit and harden owner date-based metrics
- `10902b0` — refine dashboard balance source display
- `595dea3` — add curated decorative imagery across role dashboards
- `0ba70fa` — polish decorative card art direction
- `dfa9d7c` — reorder owner home modules (Collected pieces above Ambience)

### Secretary
Secretary now has:
- redesigned dashboard
- surfaced slip upload on Home
- detail panels for transactions / tasks
- quick help panel
- cleaner English copy
- “zen desk” refinement pass
- transaction upload flow refined for mobile
- income / expense selector visually separated again with green/red treatment
- bank slip upload returned to a compact old-style pattern instead of large in-form image preview
- upload flow now clearly supports: bank slip first → scroll down → supporting proof
- mobile date input layout patched for Safari-style rendering issues
- secretary home `In today / Out today` logic hardened to avoid empty values when transaction dates are inconsistent
- secretary upload OCR fixed by routing the form to the real `/api/ocr` endpoint
- dashboard balance cards now fall back to transaction-ledger math when `funds.current_balance` is zeroed or stale
- secretary home no longer shows `Top funds`; the dashboard now stays focused on operational items instead of fund reporting
- curated 1stDibs imagery was added to the secretary `Art note` and `Collection` cards for a more premium visual layer
- balance source labeling now distinguishes between `Synced from funds` and `Ledger fallback`
- secretary now has a visible NotificationCenter on the dashboard so driver/housekeeper transaction alerts can surface in UI
- secretary transaction cards were iterated several times and finally aligned to the Audit Ledger typography rhythm while keeping amount visibly pinned on the right

Key commits:
- `3de89e9`
- `2b12e1f`
- `b9c865e`
- `54bbcf2`
- `097a5d4` — refine transaction upload flow for mobile
- `ad18689` — fix mobile date input layout
- `7fa0bf3` — fix secretary dashboard totals and OCR upload
- `1b8ae9a` — remove top funds from secretary home
- `fadfccd` — add curated art imagery to secretary home
- `10902b0` — refine dashboard balance source display
- `189170d` — optimize secretary curated asset images for faster loading
- `0ba70fa` — polish decorative card art direction
- `fa6e95e` — add secretary notification center for transaction alerts
- `53448d3` — fix decorative image rendering and ledger fallback query
- `7d1862d` — ensure secretary transaction amount stays visible
- `599ea17` — match secretary transaction cards to ledger rhythm
- `7059f54` — align secretary transaction card typography with ledger

### Driver
Driver now has:
- redesigned trip-oriented dashboard
- detail panels for trips / expenses / tasks
- quick help panel
- cleaner English copy
- calmer visual direction
- date-based dashboard stats hardened to use local-date logic instead of naive string slicing
- monthly expense summary now filters expense outflow more correctly

Key commits:
- `023f156`
- `f08e3b9`
- `5bef9c2`
- `1216f12` — harden driver and housekeeper date-based stats
- `595dea3` — add curated decorative imagery across role dashboards
- `0ba70fa` — polish decorative card art direction

### Housekeeper
Housekeeper now has:
- redesigned home care / family dashboard
- detail panels for expenses / maintenance / family events
- quick help panel
- refined English copy
- zen-home visual refinement
- date-based dashboard stats hardened to use local-date logic instead of naive string slicing
- monthly expense summary now filters expense outflow more correctly

Key commits:
- `96c6b3c`
- `52a4b21`
- `7ab0e50`
- `1216f12` — harden driver and housekeeper date-based stats
- `595dea3` — add curated decorative imagery across role dashboards
- `0ba70fa` — polish decorative card art direction

### Cross-role consistency / tone
A consistency sweep unified:
- top-label naming (`Studio` tone)
- panel wording
- calmer English-first copy
- cleaner “studio / estate / zen” tone across all 4 roles

Key commit:
- `5e8818c`

## Mobile upload fix
### Problem
On iPhone, the receipt upload button forced camera behavior and did not allow selecting an image from the device library.

### Fix
`capture="environment"` was removed from the hidden file input in `components/TransactionForm.jsx`.
This now allows iOS to offer camera / photo library / files behavior more naturally.

Key commit:
- `22dfe6a` — allow receipt upload from device library on mobile

## Important files changed recently
### Auth / admin
- `lib/auth.js`
- `app/login/page.jsx`
- `app/api/admin/_auth.js`
- `app/api/admin/create-user/route.js`
- `app/api/admin/update-role/route.js`
- `app/api/admin/reset-password/route.js`

### Role dashboards / UX
- `app/owner/page.jsx`
- `app/secretary/page.jsx`
- `app/driver/page.jsx`
- `app/housekeeper/page.jsx`
- `components/TransactionForm.jsx`

### Latest UI + logic notes (2026-03-15 morning)
- Secretary transaction form was adjusted based on direct feedback comparing the new form against the older upload UX.
- The new direction is: keep overall modern styling, but preserve old UX behavior where it improves mobile usability.
- Specifically, do **not** show the bank slip as a large preview block after upload on mobile.
- Instead, show a compact uploaded-state card, then let the user continue downward to add supporting proof.
- Mobile Safari/date-input rendering needed a dedicated style override to avoid broken vertical alignment in the date field.
- Dashboard metrics across secretary / driver / housekeeper / owner were hardened away from naive `toISOString().slice(...)` assumptions and now use local-date logic more consistently.
- Secretary home no longer uses the `Top funds` block; that section was removed because it was not useful for a small-team secretary workflow.
- `Art note` / `Collection` cards on secretary home now use curated image assets from 1stDibs-hosted CDN downloads stored in `public/art-blocks/`.
- Decorative cards across driver / housekeeper / owner were later upgraded to use the same curated-image strategy, so all role dashboards now share a more premium and consistent visual language.
- Decorative assets were compressed down for faster mobile loading, then polished with improved focal-point cropping and more cinematic overlay tuning.
- Owner Home layout was later adjusted so `Collected pieces` appears above `Ambience`, matching the preferred visual hierarchy.
- Secretary received a visible notification center so submitted transactions from driver / housekeeper can surface in-role instead of only existing in backend data.
- Secretary transaction cards went through multiple iterations; final direction is to mirror the Audit Ledger typography rhythm and keep the transaction amount visibly pinned on the right.
- A later merge moved Audit Ledger capabilities into Secretary → Transactions. Important lesson: do **not** rely only on client-side Supabase queries for secretary transaction data on production, because RLS / relation differences can make the UI look empty even when data exists. Current safer direction is to load secretary transaction data via the authenticated server API route (`GET /api/transactions`) and only use client-side querying as fallback.
- Notification items related to transactions should deep-link with context so back-navigation stays correct. Current behavior:
  - Secretary opens transaction notifications in-place inside `/secretary` (Transactions tab + detail overlay)
  - Owner opens transaction notifications via `/transactions?tx=<id>&from=owner`
- **Performance pass completed.** After merging Audit Ledger into Secretary → Transactions, load cost had increased. The following optimizations were applied:
  - **Shared components:** `ImageLightbox` and `TransactionDetail` extracted into `components/shared/` — used by both `/secretary` and `/transactions` pages
  - **Lazy-load by tab:** Secretary Home tab loads only summary data (funds + tasks + 10 recent tx via `/api/dashboard/secretary`). Full transaction list loads only when the Transactions tab is first opened
  - **Server-side summary API:** `GET /api/dashboard/secretary` returns pre-computed dashboard data (funds, tasks, recent tx, today income/expense, pending count) in a single request
  - **Transaction pagination:** `/api/transactions` now supports `offset` + `limit` + optional `month`/`year` query params with total count. The `/transactions` ledger page uses 30-row pages with a "Load more" button
  - Server API loading remains the safer production path; client-side Supabase querying is only used as fallback
- **Important failed attempt (do not repeat blindly):** a later experiment tried to delay Owner/Secretary Home balance + transaction loading behind a greeting CTA ("Tap here to view your balance"). The JSX was modified in-place and introduced broken nesting / compile failures in both `app/owner/page.jsx` and `app/secretary/page.jsx`. That attempt was explicitly **rolled back** with `git checkout -- app/secretary/page.jsx app/owner/page.jsx`, and the repo was confirmed build-clean afterward. If this UX idea is revisited, it should be implemented as a dedicated performance task with smaller isolated refactors instead of patching large JSX branches inline.
- Transaction audit behavior was upgraded in phases:
  - **Phase 1:** rejected transactions are preserved instead of deleted
  - **Phase 2:** approved transactions can update `funds.current_balance` when `fund_id` is set
  - **Phase 3:** owner/secretary balance cards now prefer real fund balances and explicitly label when they are still using ledger fallback

### Shared components (new)
- `components/shared/ImageLightbox.jsx` — full-screen image viewer with touch swipe + keyboard nav
- `components/shared/TransactionDetail.jsx` — transaction detail panel with audit actions (approve/reject)

### Performance / API (new)
- `app/api/dashboard/secretary/route.js` — lightweight summary endpoint for secretary Home tab

### Security hardening (2026-03-16)
- **OCR endpoint auth:** `/api/ocr` now requires bearer token authentication
- **Password generation:** Upgraded from `Math.random` (36^6 entropy) to `crypto.randomBytes` (base64url, 10 chars)
- **Amount validation:** Transaction approval validates amount is finite positive number before fund mutation
- **Idempotency guard:** PATCH `/api/transactions` returns 409 if tx already approved/rejected
- **Reject reason length:** Max 500 chars enforced server-side
- **Sanitized errors:** All API routes return generic error messages, internal details logged server-side only
- **Security headers:** `next.config.js` now sets X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy
- **Bank slip storage:** SELECT policy restricted to own folder or owner/secretary role
- **home_settings RLS:** UPDATE restricted to owner role only
- **Notifications PATCH:** Returns 404 if notification not found instead of silent success
- **Date filtering fix:** `/api/transactions` GET now filters by `transaction_date` (not `created_at`) to match display
- **Frontend:** Empty states now have icons, form labels added for a11y, ESC key dismisses modals, task form has loading state, sheet border radius normalized to 24px

### Performance optimization — secretary home (2026-03-16)
- **Font preloading:** `app/layout.jsx` now uses `preconnect` + `preload` for Google Fonts (Manrope + Material Symbols) to eliminate DNS+TLS latency on first load
- **Session token caching:** `lib/auth.js` added `tokenRef` (useRef) to cache `access_token` in memory. New `getToken()` callback avoids redundant `supabase.auth.getSession()` network round-trips on every API call
- **Polling elimination:** `NotificationCenter.jsx` removed 60-second polling interval — now relies on initial fetch + Supabase Realtime subscription only
- **Bundle reduction:** Replaced all `lucide-react` icon imports (~40KB) with already-loaded Material Symbols via `MIcon` component in `TransactionForm.jsx`. Removed `lucide-react` from `package.json` entirely
- **Reduced initial data load:** Secretary `loadFullTransactions` default limit reduced from 200 to 30 rows
- **Auth for OCR:** `TransactionForm.jsx` updated to pass bearer token to `/api/ocr` (required after security hardening) and uses `getToken()` for notify-submit call

### Bank slip upload overhaul (2026-03-16)
- **Multi-slip upload:** TransactionForm now supports uploading 1-5 bank slips at once via a single button. Replaced the old single-slip + separate supporting proof sections with a 3-step flow
- **Step 1 — Upload:** User selects 1-5 bank slip images, sees horizontal scroll thumbnail strip, picks fund, taps "Scan N slips"
- **Step 2 — Scan animation:** Beautiful animated scanning overlay with scan-line effect, progress bar showing "Scanning X/Y...", auto-transitions to review
- **Step 3 — Review & submit:** Each scanned slip becomes an editable transaction card showing OCR-extracted data (amount, recipient, bank, description, date, code). User can edit fields, add supporting images per transaction (0-10 each), remove transactions, then batch-submit all at once
- **OCR template system:** New `ocr_templates` table stores known bank layouts. After first successful scan of a bank (e.g., Techcombank), the system saves the template. Subsequent scans of the same bank use a shorter, faster OCR prompt (300 tokens vs 500)
- **Template API:** New `GET /api/ocr/templates` endpoint lists known bank templates with extraction counts
- **All roles supported:** Secretary, driver, and housekeeper all share the same TransactionForm component — no changes needed to role pages
- **Batch transaction creation:** Multiple transactions are created sequentially, each with its own slip image upload and reviewer notification

### DB / config
- `supabase/schema.sql`
- `supabase/storage.sql`
- `supabase/seed.sql`
- `middleware.js`
- `app/layout.jsx`

## Known caveats / important notes
1. **Admin hardening is improved, but not ultimate security**
   - current protection verifies bearer token + owner role
   - future improvement could move toward stricter server session handling and audit trails

2. **Self password change UI is currently exposed from owner Security panel**
   - broader rollout to non-owner roles is not done yet

3. **Many edit/delete flows are still missing**
   - app is much more usable now, but CRUD completeness is still partial

4. **UI is much better, but product depth is now the bigger priority**
   - more surface polish is no longer the best leverage compared to CRUD completion and stronger operations

## Deploy / env notes
Production should have these env vars set correctly:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SECRET` (legacy / optional depending on future cleanup)

## Transaction Audit System

### Overview
All household financial transactions flow through a centralized audit pipeline. Staff members (housekeeper, driver, secretary) submit transactions that must be reviewed before they are accepted into the system.

### Roles & permissions

| Action | Owner | Secretary | Housekeeper | Driver |
|---|---|---|---|---|
| Submit transactions | — | Yes | Yes | Yes |
| View all transactions (Ledger) | Yes | Yes | — | — |
| Approve transactions | Yes | Yes (not own) | — | — |
| Reject transactions | Yes | Yes (not own) | — | — |

**Key rule:** Owner can reject any transaction, including those submitted by the secretary. Secretary can only review transactions submitted by housekeeper and driver — never their own.

### Transaction lifecycle

```
Submit (pending) → Review → Approve (accepted into system)
                         → Reject (status=rejected + submitter notified)
```

A rejected transaction is **preserved for audit trail** in the database. The submitter receives a real-time notification with the rejection reason and can review/resubmit if needed.

### Real-time notifications

| Event | Who gets notified |
|---|---|
| Housekeeper/Driver submits a transaction | Secretary |
| Secretary submits a transaction | Owner |
| Transaction approved | Original submitter |
| Transaction rejected (with reason) | Original submitter |

Notifications are delivered via Supabase Realtime (postgres_changes) and appear instantly in the in-app notification center.

### Transaction Ledger page (`/transactions`)
Accessible by **owner and secretary only**. Features:
- Full list of all transactions across all staff, sorted newest-first
- Filter by month and year
- Real-time text search (instant, client-side)
- Tap any row to open the detail/audit view

### Transaction Detail view
Full-screen detail panel showing all transaction fields including bank slip image, supporting proof images, proof links, and notes. Image gallery supports tap-to-zoom with swipe navigation. Audit actions (approve / reject with note) are available at the bottom.

### Income tracking
Owner home screen shows **"Income this month"** = sum of all `type: "income"` transactions in the current month. This reflects income entered by the secretary in real time.

## Summary for the next agent
This app is now in a **transaction audit + operations** phase.
Priority areas: complete the audit pipeline, deepen CRUD flows for tasks/maintenance/schedule, expand self-service to other roles.
