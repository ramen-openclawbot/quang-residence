# HANDOFF.md — ZenHome App

_Last updated: 2026-03-14 19:05 GMT+7_

## Repo
- Local path: `/Users/mrquang/dev app/zenhome-app`
- GitHub: `https://github.com/ramen-openclawbot/quang-residence.git`
- Branch: `main`
- Current pushed commit: `7fa0bf3`

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

Key commits:
- `3de89e9`
- `2b12e1f`
- `b9c865e`
- `54bbcf2`
- `097a5d4` — refine transaction upload flow for mobile
- `ad18689` — fix mobile date input layout
- `7fa0bf3` — fix secretary dashboard totals and OCR upload

### Driver
Driver now has:
- redesigned trip-oriented dashboard
- detail panels for trips / expenses / tasks
- quick help panel
- cleaner English copy
- calmer visual direction

Key commits:
- `023f156`
- `f08e3b9`
- `5bef9c2`

### Housekeeper
Housekeeper now has:
- redesigned home care / family dashboard
- detail panels for expenses / maintenance / family events
- quick help panel
- refined English copy
- zen-home visual refinement

Key commits:
- `96c6b3c`
- `52a4b21`
- `7ab0e50`

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

### Latest UI notes (2026-03-14 evening)
- Secretary transaction form was adjusted based on direct feedback comparing the new form against the older upload UX.
- The new direction is: keep overall modern styling, but preserve old UX behavior where it improves mobile usability.
- Specifically, do **not** show the bank slip as a large preview block after upload on mobile.
- Instead, show a compact uploaded-state card, then let the user continue downward to add supporting proof.
- Mobile Safari/date-input rendering needed a dedicated style override to avoid broken vertical alignment in the date field.
- A later issue also showed that dashboard balance cards could display `0` even when transactions existed, because the UI trusted `funds.current_balance` only. Current direction: if fund balances are stale/zero, fall back to net transactions so the dashboard still reflects real activity.

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
                         → Reject (deleted permanently + submitter notified)
```

A rejected transaction is **permanently removed** from the database. The submitter receives a real-time notification with the rejection reason and must create a new transaction from scratch if needed.

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
