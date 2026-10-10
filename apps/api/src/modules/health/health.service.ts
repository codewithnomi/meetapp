// Health check logic (AC-F00-02): every part is checked in parallel with its own 1.5 s limit,
// so one slow service can't make the whole answer slow.
import type { HealthResponse } from "@meetapp/contracts";

export const CHECK_TIMEOUT_MS = 1500;

export type HealthCheck = () => Promise<unknown>;

function withTimeout(check: HealthCheck, timeoutMs: number): Promise<"ok" | "down"> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"down">((resolve) => {
    timer = setTimeout(() => resolve("down"), timeoutMs);
  });
  const run = Promise.resolve()
    .then(check)
    .then(
      () => "ok" as const,
      () => "down" as const,
    );
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}

export function createHealthService(checks: Record<string, HealthCheck>, timeoutMs = CHECK_TIMEOUT_MS) {
  return {
    async check(): Promise<HealthResponse> {
      const names = Object.keys(checks);
      const states = await Promise.all(names.map((name) => withTimeout(checks[name] as HealthCheck, timeoutMs)));
      const results = Object.fromEntries(names.map((name, index) => [name, states[index] ?? "down"]));
      const allOk = states.every((state) => state === "ok");
      return { status: allOk ? "ok" : "degraded", checks: results };
    },
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
