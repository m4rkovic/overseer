# OVERSEER

Private development workspace. One workspace. Total oversight.

## Architecture
- React / TypeScript / Vite static frontend; intended hosting: GitHub Pages.
- Supabase PostgreSQL + Auth, no Vercel or Neon.
- Public source code, private workspace data. The browser uses a publishable key only. Every table is owner-scoped with RLS. No service-role credentials belong in this repository.

## Setup
1. In the Supabase project Auth dashboard, disable public signups and create/confirm your administrator user. The frontend is sign-in only.
2. The initial schema is already applied to the dedicated Supabase project; the SQL is in `supabase/migrations`.
3. Run `npm install`, then `npm run dev`. For release, generate and commit the npm lockfile, then use `npm ci` and `npm run build`.
4. Configure GitHub Pages with GitHub Actions, after build and security checks pass.

## Agent workflow
- Read projects and project_memory, then execution_queue ordered by priority and creation date.
- Verify GitHub branch and PR state before work.
- Record session progress, tests and next step in tasks/work_sessions.
- Keep repository/project data private; do not store credentials, secret tokens or customer data.
- Never merge, deploy or delete production data merely because an approval row exists; validate the actual user's authorization. Queue eligibility is not an execution engine.

## Current scope
Project creation, task list/board and editor, dependency management, queue, memory creation, decisions/session/activity read views, approval review. Auth provisioning, automated audit events, concurrency-safe job leasing, cyclic dependency validation, integration tests, GitHub Pages deployment and lockfile verification remain to be completed. No polling or background execution is enabled.
