// `pnpm seed` only on this computer (AC-F01-30, TC-F01-75): the sample data includes accounts with a
// published password, so it must never reach a shared or online database.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Why seeding is refused with these settings, or undefined when it may go ahead. */
export function seedRefusal(env: Record<string, string | undefined>): string | undefined {
  const mode = env["NODE_ENV"];
  if (mode !== "development" && mode !== "test") {
    return `Refusing to add sample data: NODE_ENV is "${mode ?? "not set"}"; it must be "development" or "test".`;
  }
  const host = env["POSTGRES_HOST"] ?? "127.0.0.1";
  if (!LOCAL_HOSTS.has(host)) {
    return `Refusing to add sample data: the database at "${host}" is not on this computer.`;
  }
  return undefined;
}
