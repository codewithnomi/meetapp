// `pnpm seed` adds sample data; `pnpm seed:clear` removes it (AC-F00-45).
import { clearSeed, seedDatabase } from "@meetapp/db";
import { fail, withDatabase } from "./database.ts";

const command = process.argv[2] ?? "add";
if (command !== "add" && command !== "clear") fail("Usage: pnpm seed   or   pnpm seed:clear");

const count = await withDatabase((db) => (command === "add" ? seedDatabase(db) : clearSeed(db)));
process.stdout.write(
  command === "add"
    ? `Sample data loaded: ${String(count)} new record(s); existing ones were kept.\n`
    : `Sample data removed: ${String(count)} record(s). Your own data was not touched.\n`,
);
