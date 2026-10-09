# @meetapp/config

Shared settings used by every app and package.

| File | What it is |
|---|---|
| `tsconfig.base.json` | TypeScript settings. Use `"extends": "@meetapp/config/tsconfig.base.json"`. |
| `eslint/index.js` | The lint rules for the whole repository (re-exported by the root `eslint.config.js`): typescript-eslint strict, sonarjs, jsx-a11y, Vitest, Atomic Design levels (boundaries), translations (i18next) and the hard limits from `docs/engineering/code-quality.md`. |
| `eslint/no-raw-color.js` | Our own rule `meetapp/no-raw-color`: no hex, `rgb()`/`hsl()` or fixed Tailwind palette classes outside `packages/design-tokens`. |
| `prettier.json` | Formatting (120 characters per line, double quotes). Used by the root `.prettierrc`. Markdown is not auto-formatted. |

Related root files: `.dependency-cruiser.cjs` (Atomic levels and backend layers), `knip.json` (unused code), `.jscpd.json` (duplication above 3% fails).

- **Run everything:** `pnpm check` (lint, formatting, types, architecture, unused code, duplication, structure).
- **Test:** `tools/lint-rules.test.ts` and `tools/architecture-checks.test.ts` run every rule against the deliberately broken files in `tests/fixtures/`.
- **TypeScript versions:** see decision D034 (TypeScript 7 for type checks, TypeScript 6 for lint tools).
