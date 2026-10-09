# Rules for packages/config
- Shared tool settings only; no runtime code.
- A rule change here affects every package: run `pnpm check` and `pnpm test` from the root afterwards.
- Lint rules follow docs/engineering/code-quality.md; change that document first if a rule changes.
