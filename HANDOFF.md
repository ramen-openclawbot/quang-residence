# HANDOFF.md — ZenHome App

_Last updated: 2026-03-14 (latest SQL sync + funds dedup fix)_

## Repo
- Local path: `/Users/mrquang/dev app/zenhome-app`
- GitHub: `https://github.com/ramen-openclawbot/quang-residence.git`
- Branch: `main`
- Latest local commit: `22dfe6a` (push to sync after SQL fixes committed)

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

### Secretary
Secretary now has:
- redesigned dashboard
- surfaced slip upload on Home
- detail panels for transactions / tasks
- quick help panel
- cleaner English copy
- “zen desk” refinement pass

Key commits:
- `3de89e9`
- `2b12e1f`
- `b9c865e`
- `54bbcf2`

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

## Best next steps for the next agent
### Highest-value next task
1. **Add edit / delete flows** for core records:
   - tasks
   - home maintenance
   - family schedule
   - possibly transactions (carefully)

### Then
2. Expand password/self-service logic to more roles
3. Add audit logging for: user creation, role change, password reset
4. Improve notifications/report/reporting logic
5. Consider a richer **asset / art collection module** to match the visual direction

## Monthly Budget logic (for reference)
Owner home screen shows `Monthly budget` = sum of all `funds.budget_monthly` rows from Supabase.
Default seed values: PR 50M, cash 30M, salary 20M, household 15M, kitchen 10M = **125,000,000đ total**.
The number is live — changing `budget_monthly` in the `funds` table updates the UI immediately.

## Summary for the next agent
This app is no longer in an early prototyping state.
It is now in a **stabilize, secure, and complete operations** phase.
If continuing work, prioritize:
- real edit/delete flows
- stronger lifecycle management for records
- more robust admin/user operations
- product-depth improvements over more visual-only polish
