# OVERSEER MVP release runbook

This checklist is for the development branch review, not authorization to deploy. All checks must refer to the revision selected for release. No real account credentials, private repository snapshots, customer records or privileged keys belong in this public repository.

## Gate 1: Code and isolated QA

- [ ] Review the final diff of PR #2, including workflow permissions and dependency lockfile.
- [ ] Verify frontend CI: npm ci, all regression tests, TypeScript, Vite production build, bundle budgets.
- [ ] Verify browser smoke against the production bundle with synthetic data; do not weaken the conflict, failed-write, active-session or mobile assertions to obtain a green run.
- [ ] Verify dependency audit for the exact committed lockfile.
- [ ] Verify isolated PostgreSQL migrations, owner isolation, session recovery, parallel claims and review-only hardening proposal.
- [ ] Record exact commit SHA and links to the successful runs. Do not equate CI on an older revision with final release approval.

## Gate 2: Database and account (requires explicit approval)

- [ ] Confirm the intended administrator; disable public sign-ups and anonymous sign-ins in hosted Auth.
- [ ] Provision and confirm the admin account in the Supabase dashboard. Do not share the password or service-role key.
- [ ] Review the existing production schema and migration history, and establish a recoverable backup before changing it.
- [ ] Review the SQL proposal in supabase/proposals separately. It is not a deployed migration. Check hosted role grants, existing data and compatibility before converting it to a migration.
- [ ] Verify the actual Auth/REST/RLS path using real user tokens. The isolated PostgreSQL Auth fixture is only a test double; never run it on Supabase.
- [ ] Assign privately staged projects only to the verified administrator UUID, then verify owner access and logged-out denial.

## Gate 3: Pages (requires explicit approval)

- [ ] Approve the reviewed PR and merge to main only when the intended release scope is clear.
- [ ] Enable GitHub Actions as the Pages deployment source.
- [ ] Run the manual deployment workflow with public configuration only.
- [ ] Open the deployed site; verify login, logout, task create/edit, refresh, project scoping, mobile navigation, and permissions with a dedicated non-sensitive test task.
- [ ] Record the deployed commit and deployment URL. If the application fails, stop writes and redeploy a known-good reviewed frontend; do not automatically reverse schema changes or delete records.

## Gate 4: Autonomous agent execution (separate from MVP UI)

Keep claims and writes under direct user supervision until this gate passes.

- [ ] Review transaction races between claim selection, approval withdrawal, prerequisite changes and project state changes. The current proposal narrows browser writes but does not provide a complete atomic authorization fence across these operations.
- [ ] Define which scope changes require a new explicit approval, including changes to repository identity and operations performed outside the database.
- [ ] Confirm lease/recovery behavior and reconcile external GitHub state before retrying interrupted work.
- [ ] Verify that no imported record, approval row or AI context can substitute for actual user authorization. Never treat a database lease as a fence for an external GitHub call already in flight.

## Known MVP limitations

- GitHub repository state is a manual, bounded snapshot rather than live sync.
- Browser-local settings are not cross-device preferences.
- The activity view and JSON export include only the latest loaded 100 workspace events; export is not a database backup.
- Workspace reads are not a single transactional snapshot; the UI has no background polling.
- Meta CSP does not enforce frame-ancestors or substitute for HTTP security headers.
- No production deployment is performed by the verification workflows.
