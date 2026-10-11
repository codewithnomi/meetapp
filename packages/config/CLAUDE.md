# Rules for packages/config
- Shared tool settings only; no runtime code.
- A rule change here affects every package: run `pnpm check` and `pnpm test` from the root afterwards.
- Lint rules follow docs/engineering/code-quality.md; change that document first if a rule changes.
- Lint plugins are devDependencies of this package (tooling, never shipped; keeps `pnpm audit --prod` about real app code, D040); ESLint and Prettier themselves are root devDependencies so the after-edit hook finds them.
- `typescript` here is the TS 6 compatibility package (D034). Never add plain `typescript@7` to a package: typescript-eslint would crash.
- Every new rule needs a fixture in `tests/fixtures/lint/` and a test case in `tools/lint-rules.test.ts`.
