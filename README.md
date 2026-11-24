# OVERSEER

Private development workspace. One workspace. Total oversight.

## Architecture
- React / TypeScript / Vite static frontend; intended hosting: GitHub Pages.
- Supabase PostgreSQL + Auth, no Vercel or Neon.
- Public source code, private workspace data. The browser uses a publishable key only. Every table is owner-scoped with RLS. No service-role credentials belong in this repository.

## Setup
1. In the Supabase project Auth dashboard, disable public signups and create/confirm your administrator user. The frontend is sign-in only.
2. The initial schema is already applied to the dedicated Supabase project; the SQL is in `supabase/migrations`.
3. Run `npm ci`, then `npm run dev`. Use `npm ci` and `npm run build` for release; dependency changes must update and commit the lockfile intentionally.
4. Configure GitHub Pages with GitHub Actions, after build and security checks pass.

## Agent workflow
- Read projects and project_memory, then execution_queue ordered by priority and creation date.
- Verify GitHub branch and PR state before work.
- Record session progress, tests and next step in tasks/work_sessions.
- Keep repository/project data private; do not store credentials, secret tokens or customer data.
- Never merge, deploy or delete production data merely because an approval row exists; validate the actual user's authorization. Queue eligibility is not an execution engine.

## Current scope
Project creation, task list/board and editor, dependency management, queue, memory creation, decisions/session/activity read views, approval review. Automatic operational audit events, dependency and parent cycle guards, and atomic task claiming with one active session per task are implemented. Auth provisioning, end-to-end integration tests, GitHub Pages deployment and final lockfile-based CI verification remain to be completed. No polling or background execution is enabled.

## Task execution protocol

Use an authenticated admin connector (not browser credentials) to call `select public.claim_next_task('<project UUID>');` and retrieve the returned work session. The claim transaction selects one ready task with row locking, marks it in progress, and opens a unique active work session. If it returns null, do not start arbitrary work. Verify the branch, dependencies and authorization immediately before executing. Explicitly finish or mark interrupted sessions and update task status and next step. A claim has a 30-minute lease. Use checkpoint_session to renew it while working. Call recover_expired_sessions explicitly at session startup; expired tasks become blocked until repository state is reconciled. Finish using finish_session, which rejects expired or closed sessions. Never retry external actions blindly. Approval records are workflow state, not independent permission to perform external actions.

The database records task/project/approval/session/dependency and memory/decision changes automatically. Audit rows contain operational field differences, not free-text snapshots. Authenticated clients cannot insert, alter or delete audit records. Privileged database operators remain trusted. Database-origin events cannot identify a particular AI agent without additional provenance.

## Initial private projects

Initial imports are staged in the non-exposed `overseer_private.pending_projects` table. No repository names or private project details are committed here. After the administrator creates their account in Supabase Auth, verify the exact user UUID and insert the staged records into `public.projects` with that owner ID using the admin connector. Never assign them to the first arbitrary registered user.

## Deployment

Enable GitHub Pages under Settings → Pages → Build and deployment → GitHub Actions. After the lockfile-based verification workflow passes, manually run the Deploy OVERSEER workflow. Before deployment, disable public signup in Supabase Auth and create the administrator account. Keep service-role keys out of the browser and repository.

## Agent session RPCs (trusted connector only)

- `claim_next_task(project_id)`: starts a session, returning its UUID.
- `checkpoint_session(session_id, summary, next_step)`: renews a still-active 30-minute lease.
- `finish_session(session_id, status, summary, next_step, test_result)`: updates session and task in one transaction. Status is review, done, blocked or ready.
- `recover_expired_sessions(project_id)`: marks expired sessions interrupted and in-progress tasks blocked. No scheduled polling or auto-retry.

Always verify a checkpoint succeeds before further external writes. These database leases coordinate cooperative sessions; they cannot fence external GitHub operations already in flight.

## Workspace polish

- Task list and Kanban support project, status, priority, type and text filters, with deterministic sorting and manual drag-and-drop. Active work sessions are read-only in the task editor; starting agent work requires an actual claim.
- Project registry, project memory, directives (constraint/convention records), architecture decisions and dependency overview share the existing schema. No additional database migration is required for these views.
- Task and record writes use explicit editable fields and an updated_at comparison to reject stale edits. Database RLS and constraints remain authoritative; UI locks are advisory, not authorization.
- Paginated workspace reads occur on sign-in, explicit refresh and successful mutations. Activity remains limited to the most recent 100 events. No background polling.
- Run `npm test` using Node 22 for dependency-free domain tests. Full frontend build and end-to-end browser verification are separate release gates.

## Operations views

- **Tasks / Bulk:** select filtered tasks and change priority or manual status. Each row uses a revision check, active sessions are excluded, and partial failures are reported. Bulk changes are not atomic across rows.
- **Task detail:** description, acceptance criteria, next step, test result, branch, PR, relationships, approvals, sessions and recent activity.
- **Dependencies:** topological levels and prerequisite relationships; unresolved cycles are flagged.
- **Delivery:** project-scoped counts and recorded branch/PR/test state. This is not a live GitHub API integration.
- **Handover:** a reviewable, copyable summary from the selected work session, project directives and accepted decisions.
- **Export:** user-triggered local JSON for one project. It contains private data and only currently loaded activity (latest 100 across the workspace); it is not a complete database backup.

Run `npm test` to execute both domain and operations suites. See `AGENTS.md` for the agent operating protocol. These changes use the existing database schema; no deployment or database changes are required for code review.

## Planning and workspace preferences

- New task templates for feature, bug fix, refactoring and release preparation. Templates populate a draft; they never execute an operation.
- Epics: descendant completion and blocked counts. Cancelled tasks and epic containers do not count; nested tasks count once per epic.
- Health: open, ready, waiting, blocked, expired sessions, pending approvals and missing next step, computed from the loaded data.
- Saved task views are per account, browser-local, maximum 30. They store filters, scope and layout, not credentials. They are not synced across devices.
- Activity filters use the latest 100 loaded workspace events; no extra network calls or background polling.
- Shortcuts: Ctrl/Cmd+K search, Alt+Shift+N new task, Alt+Shift+R refresh, Alt+Shift+T tasks.
- Task constraint calculations use a shared indexed map instead of scanning all tasks repeatedly. No new runtime dependency or migration.

## Repository context and workspace settings

- **Repositories:** generate a read-only snapshot locally using an authenticated GitHub CLI: `node scripts/github-snapshot.mjs OWNER/REPO > snapshot.json`. Import the JSON into the matching project. The app validates identity and allowed fields, never stores a GitHub token, and keeps snapshots in memory only until sign-out or reload. Recent default-branch commits and recent PRs are bounded, not a complete GitHub history. Imported snapshots are not live verification.
- **AI context:** copy a project-scoped overview of directives, memory, accepted decisions, eligible tasks, recent sessions, approvals and optional imported repository state. Review private data before sharing. These records do not grant authorization.
- **Suggested queue order:** priority first, then number of direct dependents, then existing deterministic tie-breakers. Advisory only; actual claiming order remains unchanged in PostgreSQL.
- **Settings:** compact or comfortable density, default task view, and shortcut hints are stored locally per account. No additional infrastructure or background requests.
- **Recovery:** application error boundary offers a reload without transmitting private diagnostics. It catches rendering errors, not all asynchronous or external failures.

## Reproducible dependency installation

The committed npm lockfile was obtained from successful CI run 45373826054 and verified byte-for-byte against its artifact. CI now requires `npm ci` instead of generating a new lockfile during a build. The temporary adoption workflow has been removed; normal verification is read-only. No Pages deployment or database migration is performed.

## Frontend architecture and maintenance

- `App.tsx` is the authentication boundary; the authenticated workspace is loaded lazily.
- `Workspace.tsx` coordinates navigation, scope, task editor and view composition. It does not issue raw table queries.
- `hooks/useWorkspaceData.ts` owns workspace reads, stale-response protection and serialized mutations. Bulk writes stop scheduling further rows after unmount. Writes are never automatically retried.
- `lib/workspaceApi.ts` owns database operations and revision-checked task/record updates. Approval resolution and dependency removal detect zero-row results rather than claiming success.
- `components/WorkspaceShell.tsx`, `CommandPalette.tsx`, `TasksView.tsx` and `RecordViews.tsx` own presentation. Kanban tasks are grouped once per filtered task collection.
- `domain.ts`, `operations.ts`, `planning.ts` and `context.ts` own pure domain computations. Keep database access and browser storage outside those modules.
- Architecture tests reject direct Supabase client access in presentational components. Keep future changes focused; avoid adding a dependency just to implement a small utility.

The current refactor does not change database schema or RLS, and does not publish the app. Frontend modal controls and task locks are not authorization boundaries. Real-account end-to-end tests, database-side concurrent-write tests and measured network/browser performance remain separate release gates.

## Network, bundle and browser verification

- Full workspace reads use explicit field projections, cancel superseded reads and abort when the workspace unmounts. Each refresh has a 20-second timeout. A transient read error may be retried once; auth, rate-limit and validation errors are not retried. Never automatically retry a mutation.
- Pagination remains deterministic but is not a cross-table transactional snapshot. The reader fails visibly if the per-table safety limit is reached. An explicit refresh and successful mutations still load the full workspace for consistency; no polling.
- Operations, repository context and settings are loaded on demand. CI records gzip bundle size with a 200 KiB aggregate JS/CSS budget and a 130 KiB per-JS-asset budget. Build #54 measured 120,888 bytes gzip for all JS/CSS assets.
- `tests/browser_smoke.py` tests the built frontend using Playwright with synthetic auth and API responses. Run `python -m pip install playwright==1.57.0`, `python -m playwright install chromium`, then `python tests/browser_smoke.py dist`. Browser traffic is routed only to a local static server or mocked API; no live Supabase access. The separate Browser smoke workflow verifies the same test in CI. It does not replace actual Auth/RLS integration tests.
- CSS uses shared visual tokens, normal readable formatting and scrollable sidebar navigation. No animation library or new npm runtime dependencies.

## Security and release verification

- Production build uses a restrictive meta Content Security Policy (self-hosted scripts/styles, HTTPS Supabase origin only for API requests) and no-referrer policy. Meta CSP is defense in depth, not equivalent to all HTTP security headers; frame-ancestors is not enforced by meta CSP. A browser build rejects explicitly configured non-publishable Supabase keys.
- External GitHub links are validated and canonicalized. Approvals compare the reviewed row revision before resolving; stale task writes fail rather than silently overwriting newer data.
- Browser smoke checks login, edits, stale revisions, failed writes, active sessions, keyboard navigation, mobile layout, settings and logout using synthetic API responses. Modal focus management is shared.
- Dependency security audits the committed runtime and dev dependency trees and fails on known high/critical findings. Vite was updated from 7.1.2 to the audit-recommended pinned 7.3.8 release. No new runtime dependencies.
- The isolated database regression workflow applies existing migrations in an ephemeral PostgreSQL 16 container, using a test-only Auth fixture; it checks owner isolation, privilege denial, recovery and concurrent claiming. Never run the fixture against Supabase. These checks do not exercise real Supabase Auth or the hosted REST gateway.

### Remaining deployment security gates

1. Disable public sign-ups and provision the intended administrator. Import the staged projects only for that verified owner UUID.
2. Verify real Supabase Auth, RLS and REST behavior using the actual deployment configuration. Never expose a service role or secret key to the browser.
3. Audit direct authenticated task and approval updates: UI locks are advisory, current owner-scoped policies do not enforce all workflow transitions. Before relying on the queue for autonomous agents, enforce allowed transitions, active-session restrictions and approval invalidation in a database migration reviewed separately. Repository state and actual user authorization still control external actions.
4. Confirm final frontend, browser, dependency and isolated database CI results on the release revision. No deployment or merge is performed by these verification workflows.

## Domain modules and coverage

The public `src/domain.ts` facade preserves existing import paths. Models, GitHub link validation, task computations and record validation live in focused modules under `src/domain/`. Workspace API reads bind table names to typed browser projections and order fields; these are not full generated database types or runtime response validation. The dependency overview indexes edges by task, and topological graph construction appends to adjacency lists without copying the entire list per edge.

Frontend CI publishes native Node coverage for the exercised domain tests as the `test-coverage` artifact. This measures unit-test execution, not browser UI or PostgreSQL coverage. No coverage threshold is assumed before reviewing the measured baseline.
