// Switching a feature off in the database hides it in the running app within 30 s, without restarting
// the backend (AC-F00-34): TC-F00-72. Needs the test services and a running backend, so it runs from
// `pnpm test`, which provides MEETAPP_E2E_API_URL and MEETAPP_E2E_API_PID.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { freshProfile, launch } from "./desktop.ts";

const API_URL = process.env["MEETAPP_E2E_API_URL"];
const API_PID = Number(process.env["MEETAPP_E2E_API_PID"]);
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WITHIN_MS = 30_000;

function flag(state: "on" | "off"): void {
  execFileSync(process.execPath, ["tools/flag.ts", "demo", state], { cwd: ROOT, stdio: "ignore" });
}

function apiStillRunning(): boolean {
  try {
    process.kill(API_PID, 0);
    return true;
  } catch {
    return false;
  }
}

test("TC-F00-72 [AC-F00-34] switching the demo flag off hides it within 30 s, and on shows it again", async () => {
  test.skip(!API_URL, "needs the backend; runs from `pnpm test`");
  test.setTimeout(3 * WITHIN_MS);
  flag("on");
  const { app, page } = await launch(freshProfile(), { VITE_API_URL: API_URL ?? "" });
  const demo = page.getByText("Demo feature is on");
  try {
    await expect(demo).toBeVisible({ timeout: WITHIN_MS });
    flag("off");
    await expect(demo).toBeHidden({ timeout: WITHIN_MS });
    flag("on");
    await expect(demo).toBeVisible({ timeout: WITHIN_MS });
    expect(apiStillRunning()).toBe(true);
  } finally {
    flag("off");
    await app.close();
  }
});
