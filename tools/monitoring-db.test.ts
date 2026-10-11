// The monitoring's own database login (security review, F00): Alloy reads database numbers as
// `meetapp_monitor`, which has only PostgreSQL's built-in read-only monitoring rights (pg_monitor),
// instead of the app's owner account that can change everything.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./cli.ts";
import { MONITORING_ROLE, monitoringRoleSql } from "./monitoring-db.ts";

describe("TC-F00-95 [AC-F00-42] the monitoring database login", () => {
  it("TC-F00-95 [AC-F00-42] creates the login once, keeps its password in step, and grants only pg_monitor", () => {
    const sql = monitoringRoleSql("local_dev_monitor_pw");
    expect(MONITORING_ROLE).toBe("meetapp_monitor");
    expect(sql).toContain("CREATE ROLE meetapp_monitor LOGIN PASSWORD 'local_dev_monitor_pw'");
    expect(sql).toContain("ALTER ROLE meetapp_monitor PASSWORD 'local_dev_monitor_pw'");
    expect(sql).toContain("GRANT pg_monitor TO meetapp_monitor");
    expect(sql).not.toMatch(/SUPERUSER|CREATEDB|CREATEROLE|ALL PRIVILEGES/i);
  });

  it.each(["", "with space", "quote'inside", "dollar$$sign", "semi;colon"])(
    "TC-F00-95 [AC-F00-42] a password like %j is refused with a hint (letters, digits, _ . - only)",
    (password) => {
      expect(() => monitoringRoleSql(password)).toThrow(/MONITORING_DB_PASSWORD/);
    },
  );

  it("TC-F00-95 [AC-F00-42] pnpm monitoring sets up the login, and Alloy uses it", () => {
    expect(readFileSync(join(ROOT, "tools/monitoring.ts"), "utf8")).toMatch(/ensureMonitoringRole\(/);
    const alloy = readFileSync(join(ROOT, "infra/monitoring/alloy/config.alloy"), "utf8");
    expect(alloy).toContain("meetapp_monitor");
    expect(alloy).toContain('sys.env("MONITORING_DB_PASSWORD")');
    expect(alloy).not.toContain('sys.env("POSTGRES_PASSWORD")');
  });
});
