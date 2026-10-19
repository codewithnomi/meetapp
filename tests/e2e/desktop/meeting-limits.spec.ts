// The 30-hour limit in the real app (F02 T17, TC-F02-81): the call's start is moved back in the database so
// the limit is near, and the backend's own jobs ("ending-soon", "time-limit") are started at once; the
// windows must show the notice, and then the end. 30 real hours can't be waited for. Needs the backend,
// Mailpit and the `pnpm dev` containers (`pnpm test`).
import { expect, test } from "@playwright/test";
import { hasBackendServices, runCallJob, runningCallIn, setMinutesToLimit } from "./backend-control.ts";
import { controls } from "./meeting-steps.ts";
import { hostMeeting, joinWindow, team } from "./meeting-team.ts";

test.describe.configure({ timeout: 180_000 });

test("TC-F02-81 [AC-F02-39] everybody sees the 10-minute notice (announced), and at the limit the meeting ends for all", async () => {
  test.skip(!hasBackendServices(), "needs the database and queue containers of `pnpm dev`");
  const who = await team();
  const { host, link } = await hostMeeting(who);
  const mo = await joinWindow(who.member, link);
  const callId = runningCallIn(who.workspace);
  expect(callId).toMatch(/^[0-9a-f-]{36}$/);

  // 9.5 minutes before the limit: the warning job runs.
  setMinutesToLimit(callId, 9.5);
  await runCallJob("ending-soon", callId);
  for (const window of [host, mo]) {
    await expect(window.page.getByText("The meeting ends in 10 minutes")).toBeVisible({ timeout: 20_000 });
    await expect(window.page.getByText("Meetings last at most 30 hours.", { exact: false })).toBeVisible();
    // Read out to screen readers: the notice sits in a live region.
    await expect(
      window.page.locator("[aria-live]", { hasText: "The meeting ends in 10 minutes" }).first(),
    ).toBeAttached();
  }

  // The limit arrives: the time-limit job ends the call for everyone.
  setMinutesToLimit(callId, -1);
  await runCallJob("time-limit", callId);
  for (const window of [host, mo]) {
    await expect(window.page.getByRole("heading", { name: "The meeting has ended" })).toBeVisible({ timeout: 30_000 });
    await expect(controls(window.page)).toHaveCount(0);
  }
});
