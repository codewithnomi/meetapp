// Starts Electron on the desktop app. VS Code terminals set ELECTRON_RUN_AS_NODE, which would start
// Electron as plain Node.js without a window, so it is always removed here.
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function startElectron(extraEnv: NodeJS.ProcessEnv = {}): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
  delete env["ELECTRON_RUN_AS_NODE"];
  const electron = createRequire(import.meta.url)("electron") as string;
  const child = spawn(electron, ["."], { cwd: root, env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
  // Ctrl-C closes the window too.
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
  return child;
}

if (import.meta.main) startElectron();
