---
name: deps-update
description: Handle library updates - review open Dependabot Pull Requests (or a requested upgrade), read what changed, fix breakages, keep checks green, and recommend merge or hold. Use weekly, when Dependabot PRs appear, when a security advisory names one of our libraries, or when the owner asks to update something.
argument-hint: [PR number, library name, or "all"]
---

# Update dependencies: $ARGUMENTS

1. **List** open Dependabot PRs on `codewithnomi/meetapp` (GitHub MCP), or the requested library.
2. **Per update, read before running anything:**
   - Patch or minor update, checks green: low risk.
   - **Major update** or anything in Electron, React, Tailwind, Storybook, Vite, Fastify, Drizzle, LiveKit or Playwright: read the release notes / migration guide (Context7 MCP or the project's changelog) and list the breaking changes that affect us.
   - **Security fix:** top priority; note the advisory and severity.
3. **Check out** the PR branch, install, and run `pnpm check` and `pnpm test` (and the visual tests if UI libraries changed).
4. **Fix breakages** on that branch following the migration guide, with the normal rules: tests first, no weakened tests, docs updated. If a fix is large, stop and tell the owner it needs its own small spec.
5. **Licenses:** confirm the license check still passes (a new version can change its license).
6. **Report to the owner**, one line per update: what it is, risk (low/medium/high), what changed for us, and "safe to merge" or "hold because …". Never merge yourself unless the owner asks.
7. Record notable upgrades (majors, security fixes) in `docs/progress.md`; record changed tool choices in `docs/architecture/decisions.md`.
