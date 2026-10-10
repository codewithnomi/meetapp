# Rules for apps/web
- The app's screens (the renderer). The desktop app (apps/desktop, T15) shows them; the web app (F10) will too.
- Levels: `pages/` (screens; the only place that uses `features/`), `features/` (data and app state per area), `app/` (entry, shell, translations). Components come from `@meetapp/ui`; dependency-cruiser enforces this.
- Every visible text and accessible name comes from `src/locales/en.json` through `t("…")`; a test checks every key exists.
- The saved look is applied by `features/appearance/apply-saved.ts`, imported FIRST in `app/main.tsx`. Keep it first (no wrong-theme flash).
- No inline scripts in `index.html`: the desktop app's security policy blocks them.
- Relative imports with file extensions; no path aliases.
