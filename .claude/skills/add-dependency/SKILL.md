---
name: add-dependency
description: Vet a library BEFORE adding it to the project - is it needed, maintained, safely licensed, small enough, and does something we already have do the job? Then add it with the right scope and record the choice. Use whenever code needs a new npm/Python package or Docker image that the approved design doesn't already name.
argument-hint: <package name> [why it's needed]
---

# Add a dependency: $ARGUMENTS

Every library is code we must keep safe and updated for years. Add one only when it clearly earns its place.

1. **Is it needed?** Check whether the platform (Node, the browser, React), an existing dependency (`package.json` files), or a few lines of our own code already do the job. If so, don't add it.
2. **Is it named in an approved design.md or decisions.md?** If yes, skip to step 5 (it was already vetted).
3. **Vet it.** Check and note:
   - **License:** must pass `tools/check-licenses.ts` (no GPL/AGPL/LGPL/SSPL/unknown)
   - **Maintenance:** a release within the last 12 months, open security advisories (`pnpm audit`), several maintainers
   - **Size:** install size and, for app code, bundle impact; prefer small, tree-shakable packages
   - **Security:** no install scripts unless needed; types included or from DefinitelyTyped
   - **Docs:** read its current docs via Context7 MCP; never rely on memory for its API
4. **Decide.** If there's a real choice between options, or it's a significant new technology, add a decision to `docs/architecture/decisions.md` (status proposed) and tell the owner in one line. Small helpers just need a line in the PR description.
5. **Add it** to the right package only (`pnpm --filter <package> add …`, or `-D` for dev tools), at the latest stable version. Never install globally.
6. Run `pnpm check` and `pnpm test`. Commit the lockfile with the change.
