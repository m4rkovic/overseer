# MVP release checklist

- [ ] TypeScript and Vite build passes in CI.
- [ ] Commit generated npm lockfile and rerun npm ci.
- [ ] Disable public signup and provision the administrator in Supabase Auth.
- [ ] Assign staged projects to the verified administrator UUID.
- [ ] Verify logged-out denial and owner-scoped access.
- [ ] Configure GitHub Pages source: GitHub Actions.
- [ ] Run manual deployment and smoke-test sign-in, task editor, queue and activity.
- [ ] Do not expose private repository data or service-role credentials.
