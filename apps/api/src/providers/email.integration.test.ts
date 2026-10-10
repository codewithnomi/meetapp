// Integration tests for email against the local fake inbox, Mailpit (F00 T8, AC-F00-35): `pnpm email:test`
// delivers to Mailpit, and the email provider only talks to the host in MAILPIT_HOST (127.0.0.1 locally).
// Needs `pnpm dev` services running; run with `pnpm test:integration`.
import { describe, expect, it } from "vitest";
import { freePort, localConfig, runTool, setting } from "../test-support/integration.ts";
import { createEmailProvider } from "./email.ts";

const RECIPIENT = "test@meetapp.local";

interface MailpitMessage {
  Subject: string;
  To: { Address: string }[];
  From: { Address: string };
}

async function mailpitMessages(): Promise<MailpitMessage[]> {
  const url = `http://127.0.0.1:${setting("MAILPIT_WEB_PORT")}/api/v1/messages?limit=200`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  expect(response.status).toBe(200);
  return ((await response.json()) as { messages: MailpitMessage[] }).messages;
}

describe("TC-F00-76 [AC-F00-35] emails land in the local fake inbox", () => {
  it("TC-F00-76 [AC-F00-35] `pnpm email:test` exits 0 and Mailpit lists the message with its subject and recipient", async () => {
    const result = await runTool("email-test.ts");
    expect(result.code, result.output).toBe(0);
    const subject = /to see "(.+)"/.exec(result.output)?.[1];
    expect(subject, result.output).toMatch(/^MeetApp email check /);

    const deadline = Date.now() + 5_000;
    let found: MailpitMessage | undefined;
    while (found === undefined && Date.now() < deadline) {
      found = (await mailpitMessages()).find((message) => message.Subject === subject);
      if (found === undefined) await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(found, `"${subject ?? ""}" is not in Mailpit`).toBeDefined();
    expect(found?.To.map((to) => to.Address)).toEqual([RECIPIENT]);
    expect(found?.From.Address).toBe("no-reply@meetapp.local");
  }, 30_000);

  it("TC-F00-76 [AC-F00-35] the local settings point email at this computer (127.0.0.1)", () => {
    expect(localConfig().MAILPIT_HOST).toBe("127.0.0.1");
  });

  it("TC-F00-76 [AC-F00-35] no external SMTP host: with nothing listening on MAILPIT_HOST, sending fails fast on 127.0.0.1", async () => {
    const closedPort = await freePort();
    const email = createEmailProvider({ ...localConfig(), MAILPIT_HOST: "127.0.0.1", MAILPIT_SMTP_PORT: closedPort });
    const started = performance.now();
    try {
      const error: unknown = await email
        .send({ to: RECIPIENT, subject: "should not be delivered", text: "-" })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      const details = `${(error as Error).message} ${String((error as NodeJS.ErrnoException).code)}`;
      expect(details).toMatch(/ECONNREFUSED/);
      expect(details).toContain(`127.0.0.1:${String(closedPort)}`);
      expect(performance.now() - started).toBeLessThan(2_000);
    } finally {
      await email.close();
    }
  });
});
