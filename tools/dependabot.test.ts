// TC-F00-69: Dependabot is set up weekly, one grouped pull request per ecosystem.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

interface Update {
  "package-ecosystem": string;
  directory: string;
  schedule: { interval: string };
  groups?: Record<string, { patterns?: string[] }>;
}

const file = new URL("../.github/dependabot.yml", import.meta.url).pathname;
const config = parse(readFileSync(file, "utf8")) as { version: number; updates: Update[] };
const find = (eco: string) => config.updates.find((u) => u["package-ecosystem"] === eco);

describe("TC-F00-69 [AC-F00-32] dependabot config", () => {
  it("TC-F00-69 [AC-F00-32] uses version 2", () => {
    expect(config.version).toBe(2);
  });

  it.each([
    ["npm", "/"],
    ["docker-compose", "/infra"],
    ["docker", "/apps/api"],
    ["github-actions", "/"],
  ])("TC-F00-69 [AC-F00-32] %s in %s is weekly and grouped", (eco, dir) => {
    const u = find(eco);
    expect(u).toBeDefined();
    expect(u?.directory).toBe(dir);
    expect(u?.schedule.interval).toBe("weekly");
    const groups = Object.values(u?.groups ?? {});
    expect(groups.some((g) => g.patterns?.length === 1 && g.patterns[0] === "*")).toBe(true);
  });

  it("TC-F00-69 [AC-F00-32] only ecosystems Dependabot accepts", () => {
    const ok = new Set(["npm", "docker", "docker-compose", "github-actions"]);
    for (const u of config.updates) expect(ok.has(u["package-ecosystem"])).toBe(true);
    expect(config.updates).toHaveLength(4);
  });
});
