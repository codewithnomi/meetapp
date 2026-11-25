// TC-F01-70 (AC-F01-27): the outbox really delivers a queued email, with its HTML and plain text, to the
// local fake inbox through the queue in Redis. Needs the `pnpm dev` services running.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createEmailProvider } from "../providers/email.ts";
import { localConfig } from "../test-support/integration.ts";
import { countEmails, readEmail, waitForEmail } from "../test-support/mailpit.ts";
import { createEmailOutbox } from "./outbox.ts";

const config = localConfig();
const provider = createEmailProvider(config);
const outbox = createEmailOutbox({ host: config.REDIS_HOST, port: config.REDIS_PORT }, provider);

afterAll(async () => {
  await outbox.close();
  await provider.close();
});

describe("TC-F01-70 [AC-F01-27] the email outbox", () => {
  it("TC-F01-70 [AC-F01-27] a queued code email arrives in Mailpit with HTML and plain text", async () => {
    const to = `outbox-${randomUUID()}@example.test`;
    const since = new Date(Date.now() - 1_000);
    await outbox.outbox.enqueue({ to, template: { kind: "code", purpose: "sign-in", code: "314159" } });
    const message = await waitForEmail(to, { since });
    expect(message.Subject).toContain("314159");
    const body = await readEmail(message.ID);
    expect(body.HTML).toContain("<strong>314159</strong>");
    expect(body.Text).toContain("15 minutes");
  }, 30_000);

  it("TC-F13-58 [AC-F13-27] a failing note after sending doesn't send again; nothing to send is told as not sent (T-fix-4)", async () => {
    const to = `once-${randomUUID()}@example.test`;
    const since = new Date(Date.now() - 1_000);
    const settled: [string, boolean][] = [];
    outbox.outbox.register("test-once", {
      message: async (data) => (data.to ? { to: data.to, subject: "Once", text: "Hello" } : undefined),
      settled: async (data, sent) => {
        settled.push([data.id ?? "", sent]);
        if (sent) throw new Error("the database is down");
      },
    });
    await outbox.outbox.enqueue({ resolver: "test-once", data: { id: "a", to } });
    await outbox.outbox.enqueue({ resolver: "test-once", data: { id: "b" } });
    await waitForEmail(to, { since });
    await expect.poll(() => settled.length, { timeout: 10_000 }).toBe(2);
    // A retry would come after 2 seconds; wait past it.
    await new Promise((done) => setTimeout(done, 3_000));
    expect(await countEmails(to, since)).toBe(1);
    expect(settled.sort()).toEqual([
      ["a", true],
      ["b", false],
    ]);
  }, 30_000);
});
