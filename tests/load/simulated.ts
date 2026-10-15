// Simulated people for the load tests: LiveKit's load tool (`lk perf load-test`, infra/load) joins the
// call's room on the test call server with video (and one with sound), until stopped.
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const COMPOSE = ["compose", "-f", join(ROOT, "infra/load/docker-compose.load.yml"), "--env-file", join(ROOT, ".env")];

export interface Simulated {
  stop: () => void;
}

/** `people` simulated participants with video in `room` (the call's id); the first one also speaks. */
export function simulate(room: string, people: number, logFile: string): Simulated {
  const name = `meetapp-load-lk-${String(Date.now())}`;
  const args = [
    ...COMPOSE,
    "run",
    "--rm",
    "--name",
    name,
    "lk",
    "perf",
    "load-test",
    "--room",
    room,
    "--video-publishers",
    String(people),
    "--audio-publishers",
    "1",
    "--num-per-second",
    "10",
    "--identity-prefix",
    "sim",
    "--duration",
    "30m",
  ];
  const child = spawn("docker", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  const log = createWriteStream(logFile);
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return {
    stop: () => {
      spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
      child.kill();
    },
  };
}
