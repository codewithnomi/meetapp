# Rules for apps/desktop
- The Electron shell around apps/web. Security settings (S17, AC-F00-24) live in `src/main/security.ts` and `guards.ts`; never loosen them (no nodeIntegration, sandbox and contextIsolation always on, no new windows, CSP without inline scripts). The e2e tests in tests/e2e/desktop check them.
- The preload exposes only `window.meetapp.platform`. Anything new there needs a design change first.
- Pure logic goes in files without `electron` imports so it can be unit-tested; Electron wiring stays thin (main.ts, guards.ts, app-protocol.ts).
- Built with plain Vite (D039): `scripts/build.ts`. The main process must not `await` app readiness at the top level (Electron becomes ready only after main.ts finishes).
- VS Code terminals set ELECTRON_RUN_AS_NODE; anything that starts Electron removes it.
