# @meetapp/web: the app's screens

## What it is
The React app the desktop app shows: the sign-in screens, the side menu with the workspace switcher, Home, People, Requests and invitations, Join a workspace, and Settings (Profile and account, Appearance).

| Folder | What |
|---|---|
| `src/app/` | Entry (`main.tsx`), app shell (`App.tsx`), translations setup, stylesheet |
| `src/pages/` | Screens: sign-in (`SignInPage`, `CreateAccountPage`, `CodePage`, `NewPasswordPage`, `TermsPage`, `BrowserSignInPage`), `HomePage`, `PeoplePage`, `RequestsPage`, `JoinWorkspacePage`, `ProfilePage`, `SettingsPage` (Appearance) |
| `src/features/auth/` | Sign-in through the desktop's main process (`window.meetapp.auth`); the screens never see the token |
| `src/features/workspaces/` | `/me` every 30 s, the open workspace, the side menu, members, invitations, join link and requests |
| `src/features/profile/` | Name and photo changes, the Settings frame |
| `src/features/appearance/` | Theme and accent: saved on this computer and to the account, applied to `<html>` before the first paint, follows the computer's light/dark when "Same as my computer" is chosen |
| `src/features/api/` | One client for the backend: 10-second limit, error codes, files sent as they are |
| `src/features/flags/` | `useFlag("key")`: asks the backend every 15 s; unknown or failed means off |
| `src/locales/en.json` | Every visible text |

The backend address is `VITE_API_URL` in the root `.env` (default http://127.0.0.1:3000).

## Run it
- Normally `pnpm dev` (project root) shows it inside the desktop app.
- Alone in a browser: `pnpm --filter @meetapp/web dev` → http://127.0.0.1:5173.
- Build: `pnpm --filter @meetapp/web build` (output in `dist/`, fonts bundled, nothing loaded from the internet).

## Test it
Part of `pnpm test` and `pnpm test:unit` (project "web", simulated browser). The real-window tests are in `tests/e2e/desktop` (`pnpm test:e2e`).
