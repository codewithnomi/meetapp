# @meetapp/design-tokens

The single source of every color, font, spacing step, corner radius and shadow in MeetApp (D029, AC-F00-12).

- **`tokens.json`** is copied **unchanged** from the approved design system: https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ (file `project/tokens.json`, version 1791569887-cd84).
  - **Approved SHA-256:** `aaa0658842e95106b4becb5474f1c175db5ff2a3e822bb62c515409d48a39b90`
  - A test hashes the file and compares it with this value. To change a token: change the design system first, get it approved, copy the new file here and update this hash.
- **`pnpm --filter @meetapp/design-tokens build`** writes (into `dist/`, not committed):
  - `tokens.css`: light values on `:root`, dark on `[data-theme="dark"]`, accents on `[data-accent="…"]` (no attribute = sky), spacing, radii, fonts and the text-style classes (`.display`, `.body`, …).
  - `theme.css`: the Tailwind v4 theme with **only** token classes (`bg-surface`, `text-ink`, `rounded-full`, `shadow-2`, `text-label` …). Tailwind's own palette is removed, so `bg-blue-500` does nothing.
  - `tokens.ts`: typed names (`ACCENTS`, `COLOR_TOKENS`, `TEXT_STYLES` …).
- **Contrast:** the build stops if any required pair (design.md section 7) is below 4.5:1 for text or 3:1 for outlines, in any of the 8 accents × 2 themes, naming the pair, theme and accent.
- **Use in an app:** import `@meetapp/design-tokens/tokens.css` and, in the Tailwind entry CSS, `@import "@meetapp/design-tokens/theme.css";`. Components use only the accent aliases (`accent`, `on-accent`, `accent-text`, `accent-soft`, `focus-ring`), never `accent-blue` and friends.
- **Test:** `src/*.test.ts`.
