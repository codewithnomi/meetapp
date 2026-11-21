// TC-F13-74 (AC-F13-27, 30), security: scheduling, changing and cancelling meetings with outside invitees,
// plus refused requests, never write an email address, a passcode or a description to the logs or to an
// error answer. Own database; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { captureLogs, type CapturedLogs } from "../../test-support/fake-env.ts";
import { caller, newPerson, seedWorkspace } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let logs: CapturedLogs;
beforeAll(async () => {
  logs = captureLogs();
  t = await startAuthTestApp({ logs: logs.stream });
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const ADDRESS = "zz-private-guest-7f3a@example.test";
const DESCRIPTION = "zzSecretAgenda-91b2";

describe("logs", () => {
  it(
    "TC-F13-74 [AC-F13-27, AC-F13-30] no address, passcode or description in logs or error answers",
    { timeout: 30_000 },
    async () => {
      const call = caller(t);
      const owner = await newPerson(t, "logs-owner");
      const other = await newPerson(t, "logs-other");
      const workspaceId = await seedWorkspace(t, [
        [owner, "owner"],
        [other, "member"],
      ]);
      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const body = {
        title: "Private",
        invitees: [{ email: ADDRESS }],
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
        allDay: false,
        timeZone: "UTC",
        repeat: { kind: "weekly" },
        description: DESCRIPTION,
      };
      const made = await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, body);
      const { meetingId } = made.json<{ meetingId: string }>();
      const details = (await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`)).json<{
        passcode: string;
      }>();
      const answers = [
        await call(owner.token, "PATCH", `/api/v1/meetings/${meetingId}/schedule`, {
          scope: "series",
          description: `${DESCRIPTION}-2`,
        }),
        await call(other.token, "GET", `/api/v1/meetings/${meetingId}/schedule`),
        await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, {
          ...body,
          invitees: [{ email: `${ADDRESS}x` }, { email: "bad" }],
        }),
        await call(owner.token, "POST", `/api/v1/meetings/${meetingId}/schedule/cancel`, {
          scope: "series",
          message: DESCRIPTION,
        }),
      ];
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const written = logs.text();
      for (const secret of [ADDRESS, DESCRIPTION, details.passcode]) {
        expect(written).not.toContain(secret);
        for (const answer of answers.slice(1)) expect(answer.body).not.toContain(secret);
      }
    },
  );
});
