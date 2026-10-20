// `pnpm dev:window`: while `pnpm dev` runs, opens one more app window with a profile of its own, so the
// same computer can be two people in a meeting (sign in with another account, or the same one: F02).
// It uses the running screens' dev server and the same settings from .env as `pnpm dev`.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { startElectron } from "./electron.ts";

const RENDERER_URL = "http://127.0.0.1:5173";
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));

try {
  // Only checks that the local dev server (this computer) answers: nothing leaves the Mac.
  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
  await fetch(RENDERER_URL);
} catch {
  process.stderr.write("Start `pnpm dev` first; this opens one more window next to it.\n");
  process.exit(1);
}

const fromFile = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const env: NodeJS.ProcessEnv = {
  MEETAPP_RENDERER_URL: RENDERER_URL,
  MEETAPP_USER_DATA_DIR: mkdtempSync(join(tmpdir(), "meetapp-window-")),
};
for (const key of ["VITE_API_URL", "LIVEKIT_PORT", "LIVEKIT_PUBLIC_URL"]) {
  const value = process.env[key] ?? fromFile[key];
  if (value !== undefined) env[key] = value;
}
startElectron(env);
