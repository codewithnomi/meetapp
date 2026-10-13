// `pnpm seed` adds sample data; `pnpm seed:clear` removes it (AC-F00-45, AC-F01-30). Both refuse to run
// against anything but a development or test database on this computer.
import { SEED_PASSWORD, SEED_PEOPLE, SEED_TEAM, clearSeed, seedDatabase } from "@meetapp/db";
import { databaseSettings, fail, withDatabase } from "./database.ts";
import { seedRefusal } from "./seed-guard.ts";

const command = process.argv[2] ?? "add";
if (command !== "add" && command !== "clear") fail("Usage: pnpm seed   or   pnpm seed:clear");

const env = databaseSettings();
const refusal = seedRefusal(env);
if (refusal) fail(refusal);
const count = await withDatabase((db) => (command === "add" ? seedDatabase(db) : clearSeed(db)), env);
process.stdout.write(
  command === "add"
    ? `Sample data loaded: ${String(count)} new record(s); existing ones were kept.\n`
    : `Sample data removed: ${String(count)} record(s). Your own data was not touched.\n`,
);
if (command === "add") {
  const people = SEED_PEOPLE.map((person) => person.email).join(", ");
  process.stdout.write(`Example accounts (password "${SEED_PASSWORD}"): ${people}. Workspace: "${SEED_TEAM}".\n`);
}
