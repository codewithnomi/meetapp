// Sending email. Locally every message goes to Mailpit (a fake inbox), so nothing reaches real people
// (AC-F00-35). A real email service replaces the host and port later; the code stays the same.
import nodemailer from "nodemailer";
import type { Config } from "../config/config.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export function createEmailProvider(config: Config) {
  const transport = nodemailer.createTransport({
    host: config.MAILPIT_HOST,
    port: config.MAILPIT_SMTP_PORT,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 5000,
  });
  return {
    async send(message: EmailMessage): Promise<void> {
      await transport.sendMail({ from: config.EMAIL_FROM, ...message });
    },
    close: async () => {
      transport.close();
    },
  };
}
