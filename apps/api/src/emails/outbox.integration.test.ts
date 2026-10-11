// TC-F01-70 (AC-F01-27): the outbox really delivers a queued email, with its HTML and plain text, to the
// local fake inbox through the queue in Redis. Needs the `pnpm dev` services running.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createEmailProvider } from "../providers/email.ts";
import { localConfig } from "../test-support/integration.ts";
import { readEmail, waitForEmail } from "../test-support/mailpit.ts";
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
});
