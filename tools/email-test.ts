// `pnpm email:test`: sends one test email to the local fake inbox (Mailpit), never to a real person (AC-F00-35).
import { createEmailProvider } from "../apps/api/src/providers/email.ts";
import { backendConfig, fail } from "./backend-config.ts";

const config = backendConfig();
const email = createEmailProvider(config);
const subject = `MeetApp email check ${new Date().toISOString()}`;
try {
  await email.send({ to: "test@meetapp.local", subject, text: "If you can read this in Mailpit, email works." });
  process.stdout.write(`Test email sent to the fake inbox. Open http://127.0.0.1:8025 to see "${subject}".\n`);
} catch (error) {
  fail(`Email check failed (${(error as Error).name}). Is \`pnpm dev\` running?`);
} finally {
  await email.close();
}
