// The monitoring's own database login (security review, F00). Alloy reads database numbers as
// `meetapp_monitor`, which has only PostgreSQL's built-in read-only monitoring rights (pg_monitor),
// so a problem in the monitoring can't change or read the app's data. Its password is
// MONITORING_DB_PASSWORD in .env. `pnpm monitoring` (and the monitoring checks) set it up each time;
// running it again only brings the password in step.
import { spawnSync } from "node:child_process";

export const MONITORING_ROLE = "meetapp_monitor";

/** Kept simple on purpose: the password is placed inside SQL, so only safe characters are allowed. */
const SAFE_PASSWORD = /^[A-Za-z0-9_.-]+$/;

/** The SQL that creates the login (or updates its password) and gives it read-only monitoring rights. */
export function monitoringRoleSql(password: string): string {
  if (!SAFE_PASSWORD.test(password)) {
    throw new Error("MONITORING_DB_PASSWORD in .env may only contain letters, digits, _ . and -.");
  }
  return [
    "DO $monitor$ BEGIN",
    `  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${MONITORING_ROLE}') THEN`,
    `    CREATE ROLE ${MONITORING_ROLE} LOGIN PASSWORD '${password}';`,
    "  ELSE",
    `    ALTER ROLE ${MONITORING_ROLE} PASSWORD '${password}';`,
    "  END IF;",
    "END $monitor$;",
    `GRANT pg_monitor TO ${MONITORING_ROLE};`,
  ].join("\n");
}

/**
 * Runs that SQL in the database container, as the app's owner account (the only one allowed to create
 * logins). The SQL goes in on standard input, so the password never appears in a process list.
 * Returns an error message, or undefined when it worked.
 */
export function ensureMonitoringRole(compose: string[], env: Record<string, string>): string | undefined {
  const sql = monitoringRoleSql(env["MONITORING_DB_PASSWORD"] ?? "");
  const script = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q';
  const result = spawnSync("docker", [...compose, "exec", "-T", "postgres", "sh", "-c", script], {
    input: sql,
    encoding: "utf8",
    timeout: 30_000,
  });
  return result.status === 0 ? undefined : `The monitoring database login could not be set up:\n${result.stderr}`;
}
