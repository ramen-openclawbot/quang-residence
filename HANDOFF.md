# HANDOFF.md — ZenHome App

_Last updated: 2026-03-13 23:50 GMT+7_

## Repo
- Local path: `/Users/mrquang/dev app/zenhome-app`
- GitHub: `https://github.com/ramen-openclawbot/quang-residence.git`
- Branch: `main`
- Current pushed commit: `83203be`

## Current status
The app was migrated away from Supabase magic-link login and now uses **email + password login**.

### Auth flow now
- Login page uses `signInWithPassword()`
- Admin create-user API creates users with a **temporary password**
- Owner UI shows the temporary password after user creation so the operator can send it manually via Zalo/other channel
- Middleware cookie-based redirect logic was disabled because it interfered with browser-side Supabase auth flow

## Important recent fixes
1. Fixed Supabase env/build issues on Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
2. Fixed create-user flow to use real auth user creation instead of invite flow
3. Removed bad `profiles.email` select because `profiles` table does not have `email`
4. Moved `themeColor` from metadata to viewport to remove Next.js warning
5. Disabled cookie-based middleware redirects
6. Switched auth from magic link to password login

## User test status
- Test user: `tam@bmq.vn`
- Login: **working**
- Role was initially `driver`
- Role was manually changed to `owner` in Supabase SQL and confirmed working

### SQL used to promote test user to owner
```sql
update profiles
set role = 'owner'
where id in (
  select id
  from auth.users
  where email = 'tam@bmq.vn'
);
```

## Key files changed recently
- `lib/auth.js`
- `app/login/page.jsx`
- `app/api/admin/create-user/route.js`
- `app/owner/page.jsx`
- `app/layout.jsx`
- `middleware.js`

## Security / follow-up notes
### Important
The `create-user` API currently no longer checks `ADMIN_SECRET` in practice for the owner UI flow and should be hardened later.
Recommended follow-up:
- Protect `/api/admin/create-user` with real owner session validation on the server
- Add password reset / change-password flow
- Consider rotating any leaked Supabase `service_role` key and update both:
  - Vercel env
  - local `.env.local`

### Also recommended
- Add a proper owner-only server-side guard for admin APIs
- Add first-login password change flow
- Optionally add audit logging for user creation / role changes

## Deploy notes
If something looks wrong on production, confirm Vercel has these env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_SECRET` (if reused later)

## Suggested next tasks for the next agent
1. Harden `/api/admin/create-user` so only authenticated owner users can call it
2. Add a change-password screen for logged-in users
3. Add a reset-password/admin reset-password flow
4. Review RLS policies for all role-based pages
5. Clean up auth code/comments that still mention magic link
