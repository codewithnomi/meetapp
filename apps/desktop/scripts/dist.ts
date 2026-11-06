// `pnpm desktop:dist`: the installers (D084). The screens are built with the backend address the packaged
// app uses (settings.ts: a packaged app always talks to http://127.0.0.1:3000 until we go online), never
// the developer's own `.env` address, so the screens and the app's core reach the same server (T19 bug).
import { spawnSync } from "node:child_process";
import { DEFAULT_API_URL } from "../src/main/settings.ts";

const env = { ...process.env, VITE_API_URL: DEFAULT_API_URL };
const steps: [string, string[]][] = [
  ["pnpm", ["--filter", "@meetapp/web", "build"]],
  ["node", ["scripts/build.ts"]],
  ["pnpm", ["exec", "electron-builder", "--config", "electron-builder.config.ts"]],
];
for (const [command, args] of steps) {
  const run = spawnSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
