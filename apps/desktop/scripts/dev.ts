// `pnpm dev` for the desktop app (started by turbo next to apps/web and apps/api): builds the main
// process, waits for the screens' dev server, then opens the window. Closing the window ends it.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { buildDesktop } from "./build.ts";
import { startElectron } from "./electron.ts";

const RENDERER_URL = "http://127.0.0.1:5173";
const WAIT_MS = 60_000;
const POLL_MS = 300;
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));

async function waitForScreens(): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    try {
      // Plain http is right here: the dev server listens on 127.0.0.1 only (this computer).
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      if ((await fetch(RENDERER_URL)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  throw new Error(`The screens' dev server did not start at ${RENDERER_URL} within ${String(WAIT_MS / 1000)} s.`);
}

await buildDesktop();
await waitForScreens();

// Only the two settings the window needs leave .env; database and storage passwords stay out of it.
const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const env: NodeJS.ProcessEnv = { MEETAPP_RENDERER_URL: RENDERER_URL };
for (const key of ["VITE_API_URL", "SENTRY_DSN"]) {
  const value = process.env[key] ?? fromFile[key];
  if (value !== undefined) env[key] = value;
}
startElectron(env);
