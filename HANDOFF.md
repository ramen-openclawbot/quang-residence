# HANDOFF.md — ZenHome App

_Last updated: 2026-03-14 13:58 GMT+7_

## Repo
- Local path: `/Users/mrquang/dev app/zenhome-app`
- GitHub: `https://github.com/ramen-openclawbot/quang-residence.git`
- Branch: `main`
- Current pushed commit: `7f6d4f7`

## Current product state
ZenHome has moved well beyond the initial broken prototype state.
It now has:
- working **email + password auth**
- owner-only protected admin APIs
- temporary-password user creation flow
- owner-side role management
- owner-side password reset for users
- self password update flow for the logged-in owner
- redesigned dashboards for all 4 roles
- cleaner English-first UI direction with a calmer “Zen house / estate console” feel

## Auth / account status
### Current auth model
- Login uses `signInWithPassword()`
- Magic-link login was removed as the primary flow
- New users are created with a **temporary password**
- Owner can reset a user password from Account Management
- Owner can change their own password from Security panel

### Admin protection
Admin routes are now protected by **owner session verification**.
These routes require a valid logged-in owner bearer token:
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

### Important DB status
- scripts are now intended to be **rerunnable**
- policies were updated toward safer re-run behavior
- storage bucket `bank-slips` is defined
- `notifications` and `daily_reports` were aligned with code expectations

## Major UI / product work completed
### Owner
Owner is no longer just a static mock.
It now has:
- better live-data dashboard summaries
- notification center wiring
- settings panels with real interaction
- working **Account Management** panel
- create user flow in UI
- role update flow in UI
- reset-password flow in UI
- self password update flow in Security
- calmer “Zen estate” visual pass

Key owner-related commits:
- `3daf809` — account management panel + role updates
- `22ee13c` — owner interactions + settings panels
- `9690e23` — owner zen-estate visual refinement
- `74a49ac` — require owner session for admin APIs
- `7f6d4f7` — password reset + self password update

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
A consistency sweep was completed across all 4 roles to unify:
- top-label naming
- panel wording
- calmer English-first UI copy
- cleaner “studio / estate / zen” tone

Key commit:
- `5e8818c`

## Important files changed recently
### Auth / admin
- `lib/auth.js`
- `app/login/page.jsx`
- `app/api/admin/_auth.js`
- `app/api/admin/create-user/route.js`
- `app/api/admin/update-role/route.js`
- `app/api/admin/reset-password/route.js`

### Role dashboards
- `app/owner/page.jsx`
- `app/secretary/page.jsx`
- `app/driver/page.jsx`
- `app/housekeeper/page.jsx`

### DB / config
- `supabase/schema.sql`
- `supabase/storage.sql`
- `supabase/seed.sql`
- `middleware.js`
- `app/layout.jsx`

## Known caveats / important notes
1. **Owner admin API hardening is better now, but still not ultimate security**
   - current protection checks bearer token + owner role
   - future improvement could move toward stricter server session handling and auditing

2. **Current self password change UI is implemented from owner Security panel**
   - broader rollout to non-owner roles is not yet done

3. **Many edit/delete flows are still missing**
   - the app is now much more usable, but CRUD completeness is still partial

4. **UI quality is much better, but still mid-flight**
   - the app is no longer a broken prototype
   - however, some screens still need product-depth improvements rather than only polish

## Deploy / env notes
Production should have these env vars set correctly:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SECRET` (legacy / optional now, depending on future cleanup)

## Best next steps for the next agent
### Highest-value next task
1. **Add edit / delete flows** for core records:
   - tasks
   - home maintenance
   - family schedule
   - possibly transactions (carefully)

### Then
2. Expand password/self-service logic to more roles
3. Add proper audit logging for:
   - user creation
   - role change
   - password reset
4. Improve notifications/reporting logic
5. Consider a richer **asset / art collection module** to match the visual direction already introduced

## Summary for the next agent
This project is no longer in the early auth/firefighting phase.
The app is now in a **product-hardening + CRUD-completion** phase.
If continuing work, prioritize:
- real edit/delete flows
- stronger lifecycle management for records
- more robust admin/user operations
- selective deeper product logic over more surface polish
