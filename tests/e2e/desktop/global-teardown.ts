// Deletes this run's profile folders (made in global-setup.ts).
import { rmSync } from "node:fs";

export default function globalTeardown(): void {
  const folder = process.env["MEETAPP_E2E_PROFILES"];
  if (folder) rmSync(folder, { recursive: true, force: true });
}
