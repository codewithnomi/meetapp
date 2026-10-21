# @meetapp/desktop: the desktop app

## What it is
The Electron window that shows the app's screens (apps/web), locked down for safety.

| File | What |
|---|---|
| `src/main/main.ts` | Starts the app: settings, Sentry (only with `SENTRY_DSN`), security, the window |
| `src/main/security.ts` | Page settings (sandbox, isolation, no Node.js), which addresses count as "inside the app", which links may open in the browser, the Content Security Policy (F03 adds KLIPY: `api.klipy.com` for GIF searches, `static.klipy.com` for GIF images) |
| `src/main/guards.ts` | Applies those rules: other permissions refused, navigation and new windows blocked, CSP on every response; camera, microphone and screen as `media-permissions.ts` allows |
| `src/main/media-permissions.ts` | Camera and microphone only for MeetApp's own page, plus choosing the speakers and writing to the clipboard for the Copy buttons (reading it stays refused, D040); screen sharing only through our picker, once, within 10 s, video only (F02) |
| `src/main/chat-desktop.ts`, `chat-bridge.ts` | Meeting chat (F03): the right-click spelling menu (dictionaries from the app, never online), and `window.meetapp.files.save` (Save as, only for our backend's chat file links) |
| `src/main/media-actions.ts`, `media-bridge.ts` | `window.meetapp.media`: the computer's camera/mic/screen permission, asking for it, the screens and windows to share under stand-in ids (F02) |
| `src/main/device-key.ts` | `window.meetapp.deviceKey`: a random key for this app on this computer (a removed guest is recognised in the same call), file mode 0600 (F02) |
| `src/main/app-protocol.ts`, `serve-files.ts` | Serves the built screens from `app://meetapp`, never anything outside their folder |
| `src/main/auth-token.ts` | Keeps the sign-in token, encrypted with the system keychain (safeStorage), or in memory only when that isn't available (F01) |
| `src/main/auth-client.ts`, `auth-actions.ts` | The sign-in calls main makes for the screens, and the list of actions the screens may ask for (F01) |
| `src/main/auth-bridge.ts` | Adds the token to the screens' requests to the backend, and cancels their requests to routes that hand out a token (F01) |
| `src/main/provider-sign-in.ts` | Google/Microsoft: opens the browser and collects the result (F01) |
| `src/preload/preload.ts` | The only bridge to the screens: `window.meetapp.platform`, `window.meetapp.auth` (sign-in actions; the token never reaches the screens), `window.meetapp.media` and `window.meetapp.deviceKey` (F02) |
| `scripts/build.ts`, `scripts/dev.ts`, `scripts/electron.ts`, `scripts/second-window.ts` | Build with Vite (D039); development start-up; starting Electron (removes VS Code's ELECTRON_RUN_AS_NODE); `pnpm dev:window`, a second window with its own sign-in |

**Settings (environment)**
| Name | Meaning |
|---|---|
| `MEETAPP_RENDERER_URL` | Development: load the screens from this dev server (set by `scripts/dev.ts`) |
| `VITE_API_URL` | The backend address, also allowed in the CSP (default http://127.0.0.1:3000) |
| `MEETAPP_USER_DATA_DIR` | Tests only: a fresh profile folder; ignored in the packaged app |
| `SENTRY_DSN` | Optional crash reports, with every personal-data category switched off |
| `LIVEKIT_PORT`, `LIVEKIT_PUBLIC_URL` | Where the call server is (ws://127.0.0.1:`LIVEKIT_PORT`, or the wss:// public address); allowed in the CSP `connect-src` (F02) |

## Run it
- `pnpm dev` (project root) starts the services, the backend, the screens' dev server and this window. Closing the window stops the desktop part.
- A second window with its own sign-in (to be two people in a meeting), while `pnpm dev` runs: `pnpm dev:window`.
- Just the window, without the services: `pnpm desktop`. It builds the screens and the desktop app, then opens the window; feature flags count as off without the backend.

## Test it
- Unit tests run in `pnpm test`.
- Real-window tests: `pnpm test:e2e` rebuilds the screens and the desktop app, then opens and closes app windows for about a minute. They are also part of `pnpm test`. Don't close those windows while they run.
- Only some real-window tests, with the backend started for them: `node tools/test.ts --only desktop -- <spec file>[:line] …` (anything after `--` goes to Playwright).
