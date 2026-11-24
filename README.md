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
Project creation, task list/board and editor, dependency management, queue, memory creation, decisions/session/activity read views, approval review. Automatic operational audit events, dependency and parent cycle guards, and atomic task claiming with one active session per task are implemented. Auth provisioning, end-to-end integration tests, GitHub Pages deployment and lockfile verification remain to be completed. No polling or background execution is enabled.

## Task execution protocol

Use an authenticated admin connector (not browser credentials) to call `select public.claim_next_task('<project UUID>');` and retrieve the returned work session. The claim transaction selects one ready task with row locking, marks it in progress, and opens a unique active work session. If it returns null, do not start arbitrary work. Verify the branch, dependencies and authorization immediately before executing. Explicitly finish or mark interrupted sessions and update task status and next step. A claim has a 30-minute lease. Use checkpoint_session to renew it while working. Call recover_expired_sessions explicitly at session startup; expired tasks become blocked until repository state is reconciled. Finish using finish_session, which rejects expired or closed sessions. Never retry external actions blindly. Approval records are workflow state, not independent permission to perform external actions.

The database records task/project/approval/session/dependency and memory/decision changes automatically. Audit rows contain operational field differences, not free-text snapshots. Authenticated clients cannot insert, alter or delete audit records. Privileged database operators remain trusted. Database-origin events cannot identify a particular AI agent without additional provenance.

## Initial private projects

Initial imports are staged in the non-exposed `overseer_private.pending_projects` table. No repository names or private project details are committed here. After the administrator creates their account in Supabase Auth, verify the exact user UUID and insert the staged records into `public.projects` with that owner ID using the admin connector. Never assign them to the first arbitrary registered user.

## Deployment

Enable GitHub Pages under Settings → Pages → Build and deployment → GitHub Actions. After reviewing the verification workflow and committing its generated lockfile, manually run the Deploy OVERSEER workflow. Before deployment, disable public signup in Supabase Auth and create the administrator account. Keep service-role keys out of the browser and repository.

## Agent session RPCs (trusted connector only)

- `claim_next_task(project_id)`: starts a session, returning its UUID.
- `checkpoint_session(session_id, summary, next_step)`: renews a still-active 30-minute lease.
- `finish_session(session_id, status, summary, next_step, test_result)`: updates session and task in one transaction. Status is review, done, blocked or ready.
- `recover_expired_sessions(project_id)`: marks expired sessions interrupted and in-progress tasks blocked. No scheduled polling or auto-retry.

Always verify a checkpoint succeeds before further external writes. These database leases coordinate cooperative sessions; they cannot fence external GitHub operations already in flight.
