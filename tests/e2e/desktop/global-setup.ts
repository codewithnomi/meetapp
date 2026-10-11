// One folder per test run for the apps' profile folders, so global-teardown.ts can delete them all
// (they used to pile up in the system's temp folder: 462 after a few days).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default function globalSetup(): void {
  process.env["MEETAPP_E2E_PROFILES"] = mkdtempSync(join(tmpdir(), "meetapp-e2e-run-"));
}
