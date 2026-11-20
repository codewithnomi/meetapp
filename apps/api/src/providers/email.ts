// Sending email. Locally every message goes to Mailpit (a fake inbox), so nothing reaches real people
// (AC-F00-35). A real email service replaces the host and port later; the code stays the same.
import nodemailer from "nodemailer";
import type { Config } from "../config/config.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML version; mail apps that can't show it use `text`. */
  html?: string;
  /** A calendar file (F13): sent as the calendar part and as invite.ics. */
  calendar?: { method: "REQUEST" | "CANCEL"; content: string };
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
      const { calendar, ...rest } = message;
      await transport.sendMail({
        from: config.EMAIL_FROM,
        ...rest,
        ...(calendar
          ? { icalEvent: { method: calendar.method, filename: "invite.ics", content: calendar.content } }
          : {}),
      });
    },
    close: async () => {
      transport.close();
    },
  };
}
