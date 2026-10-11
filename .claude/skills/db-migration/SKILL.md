---
name: db-migration
description: Change the database structure safely - design the change, generate a new Drizzle migration, check it for data loss and locking, make it backwards compatible, test it up on real data, and update docs. Use whenever a table, column, index or constraint is added, changed or removed.
argument-hint: <what needs to change and why>
---

# Database change: $ARGUMENTS

Rules (docs/engineering/backend.md): never edit an existing migration (a hook blocks it); every change is a new migration; the previous app version must keep working during a deploy.

1. **Design** the change in the feature's design.md first (tables, columns, types, nullability, defaults, indexes, which queries use it). Every workspace-owned table has `workspace_id` and an index on it (security rule S2).
2. **Edit the schema** in `packages/db` and generate the migration with drizzle-kit. Read the generated SQL; never hand-wave it.
3. **Safety review** of the SQL:
   - **Data loss:** dropping or renaming a column/table, or narrowing a type, needs the expand → migrate data → contract pattern across two releases. Never in one step.
   - **Locks:** adding a NOT NULL column with no default, or building an index on a big table, must be done without long locks (default first; `CREATE INDEX CONCURRENTLY` in its own migration).
   - **Backfills** of existing rows run as a separate, re-runnable step (an idempotent job), not inside the schema migration.
   - **pgvector:** vector columns state their dimension; similarity indexes (HNSW) are created after data loads.
4. **Test:** an integration test runs all migrations on an empty database **and** on a database seeded with the previous version's data, then checks the app's queries work. Update `pnpm seed` for new tables.
5. **Inspect** the result read-only with the Postgres MCP (tables, indexes, row counts).
6. Update design.md (data section), privacy-legal.md if personal data is stored, and the retention/deletion rules (S9) if users can delete this data.
