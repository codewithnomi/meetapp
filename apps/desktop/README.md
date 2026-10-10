# @meetapp/desktop: the desktop app

The Electron window that shows the app's screens (apps/web), locked down for safety.

- **Start everything:** `pnpm dev` (root). It starts the services, the backend, the screens' dev server and this window. Closing the window stops the desktop part.
- **Just the window, without the services:** `pnpm desktop` (root). It builds the screens and the desktop app, then opens the window; flags count as off without the backend.
- **Tests:** unit tests run in `pnpm test`; the real-window tests run with `pnpm test:e2e`, which first rebuilds the screens and the desktop app, then opens and closes app windows for about 15 seconds.

## How it works
| File | What |
|---|---|
| `src/main/main.ts` | Starts the app: settings, Sentry (only with `SENTRY_DSN`), security, the window |
| `src/main/security.ts` | Page settings (sandbox, isolation, no Node.js), which addresses count as "inside the app", which links may open in the browser, the Content Security Policy |
| `src/main/guards.ts` | Applies those rules: permissions refused, navigation and new windows blocked, CSP on every response |
| `src/main/app-protocol.ts`, `serve-files.ts` | Serves the built screens from `app://meetapp`, never anything outside their folder |
| `src/preload/preload.ts` | The only bridge to the screens: `window.meetapp.platform` |
| `scripts/build.ts`, `scripts/dev.ts`, `scripts/electron.ts` | Build with Vite (D039); development start-up; starting Electron (removes VS Code's ELECTRON_RUN_AS_NODE) |

## Settings (environment)
| Name | Meaning |
|---|---|
| `MEETAPP_RENDERER_URL` | Development: load the screens from this dev server (set by `scripts/dev.ts`) |
| `VITE_API_URL` | The backend address, also allowed in the CSP (default http://127.0.0.1:3000) |
| `MEETAPP_USER_DATA_DIR` | Tests only: a fresh profile folder; ignored in the packaged app |
| `SENTRY_DSN` | Optional crash reports, with every personal-data category switched off |
