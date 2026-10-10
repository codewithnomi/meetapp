// `pnpm flag <key> on|off` switches a feature without restarting anything; `pnpm flag list` shows all
// flags (AC-F00-34). Input is checked before the database is touched, and queries are parameterized.
import { isValidFlagKey, listFlags, setFlag } from "@meetapp/db";
import { fail, withDatabase } from "./database.ts";

const USAGE = "Usage: pnpm flag <key> on|off   (example: pnpm flag home.welcome_banner off)   or   pnpm flag list";

const [key, state, ...extra] = process.argv.slice(2);

if (key === "list" && state === undefined) {
  const flags = await withDatabase((db) => listFlags(db));
  const lines = flags.map((flag) => `  ${flag.enabled ? "on " : "off"}  ${flag.key}`);
  process.stdout.write(lines.length > 0 ? `${lines.join("\n")}\n` : "No flags yet. Run `pnpm seed` to add samples.\n");
  process.exit(0);
}
if (key === undefined || state === undefined || extra.length > 0) fail(USAGE);
if (!isValidFlagKey(key)) fail(`"${key}" is not a valid flag name (lower-case letters, digits, . _ -). ${USAGE}`);
if (state !== "on" && state !== "off") fail(`Use "on" or "off", not "${state}". ${USAGE}`);

const changed = await withDatabase((db) => setFlag(db, key, state === "on"));
if (!changed) fail(`There is no flag named "${key}". See all flags with: pnpm flag list`);
process.stdout.write(`${key} is now ${state}. The app picks this up within 30 seconds.\n`);
