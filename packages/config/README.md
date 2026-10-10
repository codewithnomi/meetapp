# @meetapp/config

## What it is
Shared settings used by every app and package.

| File | What it is |
|---|---|
| `tsconfig.base.json` | TypeScript settings. Use `"extends": "@meetapp/config/tsconfig.base.json"`. |
| `eslint/index.js` | The lint rules for the whole repository (re-exported by the root `eslint.config.js`): typescript-eslint strict, sonarjs, jsx-a11y, Vitest, Atomic Design levels (boundaries), translations (i18next) and the hard limits from `docs/engineering/code-quality.md`. |
| `eslint/no-raw-color.js` | Our own rule `meetapp/no-raw-color`: no hex, `rgb()`/`hsl()` or fixed Tailwind palette classes outside `packages/design-tokens`. |
| `prettier.json` | Formatting (120 characters per line, double quotes). Used by the root `.prettierrc`. Markdown is not auto-formatted. |
| `vitest/coverage` | The coverage rule (80% per business-logic folder group) used by `pnpm test`. |

Related root files: `.dependency-cruiser.cjs` (Atomic levels and backend layers), `knip.json` (unused code), `.jscpd.json` (duplication above 3% fails). TypeScript versions: decision D034 (TypeScript 7 for type checks, TypeScript 6 for lint tools).

## Run it
Nothing to start. `pnpm check` (project root) runs every rule: lint, formatting, types, architecture, unused code, duplication, structure and licenses.

## Test it
`tools/lint-rules.test.ts`, `tools/architecture-checks.test.ts` and `tools/coverage-rule.test.ts` run each rule against deliberately broken files in `tests/fixtures/`; all are part of `pnpm test`.
