# Rules for packages/db
- Database changes only through the `db-migration` skill: new migration, never edit an old one (a hook blocks it).
- Every table has `id`, `created_at`, `updated_at`; workspace-owned tables have `workspace_id` with an index (security rule S2).
- No SQL built from text: use Drizzle's query builder or `sql` with parameters. Validate input before it reaches a query.
- Seed data never contains real personal data. `seedDatabase` must stay idempotent; `clearSeed` removes only seed records.
- `updated_at` is set by Drizzle's `$onUpdate`; raw SQL updates must set it themselves.
