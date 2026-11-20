// The email outbox (design.md section 10): requests only put an email in a queue (BullMQ on Redis);
// a worker in the API process renders and sends it. So a slow or failing mail server never blocks or
// slows a request, and answer times don't reveal whether an email was sent (AC-F01-02, 13).
// Jobs are removed as soon as they are sent, so codes don't stay in Redis. A job may instead name a
// resolver and carry only ids (F13 meeting emails): the address and the message are made when it is
// sent, so no address waits in Redis, and the resolver hears whether it was sent after the last try.
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { EmailMessage } from "../providers/email.ts";
import { renderEmail, type EmailTemplate } from "./templates.ts";

export type EmailJob = { to: string; template: EmailTemplate } | { resolver: string; data: Record<string, string> };

/** Makes a resolver job's message when it is sent; undefined = nothing to send any more. */
export interface EmailResolver {
  message: (data: Record<string, string>) => Promise<EmailMessage | undefined>;
  /** After it was sent, or after its last try failed. */
  settled?: (data: Record<string, string>, sent: boolean) => Promise<void>;
}

/** What the rest of the backend sees: "send this email soon". */
export interface Outbox {
  enqueue: (job: EmailJob) => Promise<void>;
  register: (name: string, resolver: EmailResolver) => void;
}

export interface EmailSender {
  send: (message: EmailMessage) => Promise<void>;
}

const EMAIL_QUEUE = "emails";

/** The message actually sent for a template job. */
function messageFor(job: { to: string; template: EmailTemplate }): EmailMessage {
  const email = renderEmail(job.template);
  return { to: job.to, subject: email.subject, text: email.text, html: email.html };
}

const ATTEMPTS = 5;

function resolverOf(resolvers: Map<string, EmailResolver>, name: string): EmailResolver {
  const resolver = resolvers.get(name);
  if (!resolver) throw new Error(`no email resolver ${name}`);
  return resolver;
}

/** `queueName`: tests give each app its own queue, so one test app never sends another's emails. */
export function createEmailOutbox(connection: ConnectionOptions, sender: EmailSender, queueName = EMAIL_QUEUE) {
  const queue = new Queue<EmailJob>(queueName, {
    connection,
    defaultJobOptions: {
      attempts: ATTEMPTS,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: true,
      // A failed job is kept 1 hour for diagnosis, then removed (it may hold a code).
      removeOnFail: { age: 3_600 },
    },
  });
  const resolvers = new Map<string, EmailResolver>();
  const worker = new Worker<EmailJob>(
    queueName,
    async ({ data: job }) => {
      if (!("resolver" in job)) return sender.send(messageFor(job));
      const resolver = resolverOf(resolvers, job.resolver);
      const message = await resolver.message(job.data);
      if (!message) return;
      await sender.send(message);
      await resolver.settled?.(job.data, true);
    },
    { connection, concurrency: 5 },
  );
  worker.on("failed", (job) => {
    if (!job || job.attemptsMade < ATTEMPTS || !("resolver" in job.data)) return;
    const { resolver, data } = job.data;
    void resolvers
      .get(resolver)
      ?.settled?.(data, false)
      .catch(() => undefined);
  });
  const outbox: Outbox = {
    enqueue: async (job) => {
      await queue.add("resolver" in job ? job.resolver : job.template.kind, job);
    },
    register: (name, resolver) => {
      resolvers.set(name, resolver);
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
