// Reaching the backend's own database and job queue from a desktop test, for the few things a window
// can't show: the 30-hour limit (the call's start time is moved back, then the backend's own jobs are
// started now) and what the backend keeps about a guest. Goes through the `pnpm dev` containers
// (`docker exec`), so no password is read or typed here. Tests that need it skip when Docker isn't there.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const containers = (): string[] => {
  try {
    return execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" }).split("\n");
  } catch {
    return [];
  }
};
const find = (part: string) => containers().find((name) => /^meetapp-/.test(name) && name.includes(part));

/** True when the database and queue containers of `pnpm dev` are running. */
export const hasBackendServices = () => Boolean(find("postgres") && find("redis"));

/** Runs one SQL statement in the dev database and returns its plain output (one value per line). */
export function sql(statement: string): string {
  const container = find("postgres");
  if (!container) throw new Error("the database container is not running");
  return execFileSync(
    "docker",
    ["exec", "-i", container, "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA'],
    {
      encoding: "utf8",
      input: statement,
    },
  ).trim();
}

/** The running call of the newest meeting made in the workspace called `workspaceName`. */
export function runningCallIn(workspaceName: string): string {
  const quoted = workspaceName.replaceAll("'", "''");
  return sql(
    `select id from calls where ended_at is null and workspace_id = (select id from workspaces where name = '${quoted}') order by started_at desc limit 1;`,
  );
}

/** Moves the call's start so that its 30-hour limit is `minutesLeft` minutes away (negative: passed). */
export function setMinutesToLimit(callId: string, minutesLeft: number): void {
  sql(
    `update calls set started_at = now() - interval '30 hours' + (${String(minutesLeft)} * interval '1 minute'), updated_at = now() where id = '${callId}';`,
  );
}

interface QueueLike {
  add: (name: string, data: object, options: object) => Promise<unknown>;
  close: () => Promise<void>;
}

/** Hands the backend's call worker a job now ("ending-soon" or "time-limit"); the worker runs it at once. */
export async function runCallJob(name: "ending-soon" | "time-limit", callId: string): Promise<void> {
  const container = find("redis");
  if (!container) throw new Error("the queue container is not running");
  const mapped = execFileSync("docker", ["port", container, "6379/tcp"], { encoding: "utf8" }).trim();
  const port = Number(/:(\d+)\s*$/m.exec(mapped)?.[1]);
  const { Queue } = createRequire(new URL("../../../apps/api/package.json", import.meta.url))("bullmq") as {
    Queue: new (queue: string, options: object) => QueueLike;
  };
  const queue = new Queue("calls", { connection: { host: "127.0.0.1", port } });
  await queue.add(name, { callId }, { jobId: `e2e-${name}-${callId}-${String(Date.now())}`, removeOnComplete: true });
  await queue.close();
}
