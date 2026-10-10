# @meetapp/web: the app's screens

The React app the desktop app shows. For F00 it has a starter home screen and the Appearance settings.

- **Run alone in a browser:** `pnpm --filter @meetapp/web dev` → http://127.0.0.1:5173 (normally `pnpm dev` starts it inside the desktop app, from T15).
- **Build:** `pnpm --filter @meetapp/web build` (output in `dist/`, fonts bundled, nothing loaded from the internet).
- **Tests:** part of `pnpm test` (project "web", simulated browser).
- **Backend address:** `VITE_API_URL` in the root `.env` (default http://127.0.0.1:3000).

## Inside
| Folder | What |
|---|---|
| `src/app/` | Entry (`main.tsx`), app shell (`App.tsx`), translations setup, stylesheet |
| `src/pages/` | Screens: `HomePage`, `SettingsPage` |
| `src/features/appearance/` | Theme and accent: saved on this computer, applied to `<html>` before the first paint, follows the computer's light/dark when "Same as my computer" is chosen |
| `src/features/flags/` | `useFlag("key")`: asks the backend every 15 s; unknown or failed means off |
| `src/locales/en.json` | Every visible text |
