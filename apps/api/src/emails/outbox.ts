// The email outbox (design.md section 10): requests only put an email in a queue (BullMQ on Redis);
// a worker in the API process renders and sends it. So a slow or failing mail server never blocks or
// slows a request, and answer times don't reveal whether an email was sent (AC-F01-02, 13).
// Jobs are removed as soon as they are sent, so codes don't stay in Redis.
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { EmailMessage } from "../providers/email.ts";
import { renderEmail, type EmailTemplate } from "./templates.ts";

export interface EmailJob {
  to: string;
  template: EmailTemplate;
}

/** What the rest of the backend sees: "send this email soon". */
export interface Outbox {
  enqueue: (job: EmailJob) => Promise<void>;
}

export interface EmailSender {
  send: (message: EmailMessage) => Promise<void>;
}

const EMAIL_QUEUE = "emails";

/** The message actually sent for a job. */
function messageFor(job: EmailJob): EmailMessage {
  const email = renderEmail(job.template);
  return { to: job.to, subject: email.subject, text: email.text, html: email.html };
}

export function createEmailOutbox(connection: ConnectionOptions, sender: EmailSender) {
  const queue = new Queue<EmailJob>(EMAIL_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: true,
      // A failed job is kept 1 hour for diagnosis, then removed (it may hold a code).
      removeOnFail: { age: 3_600 },
    },
  });
  const worker = new Worker<EmailJob>(EMAIL_QUEUE, async (job) => sender.send(messageFor(job.data)), {
    connection,
    concurrency: 5,
  });
  const outbox: Outbox = {
    enqueue: async (job) => {
      await queue.add(job.template.kind, job);
    },
  };
  return {
    outbox,
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
