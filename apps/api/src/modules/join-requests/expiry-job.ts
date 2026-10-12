// The daily job that marks requests to join older than 14 days as expired (F01 design.md sections 5
// and 10). It runs on BullMQ, like the email outbox, once a day at 03:00 (UTC); a scheduler with a
// fixed id means restarts and several API copies still give one run a day. Reading already treats
// old requests as expired, so a late run changes nothing anyone sees.
import { Queue, Worker, type ConnectionOptions } from "bullmq";

const QUEUE = "join-requests";
const SCHEDULER_ID = "expire-join-requests";

export async function startExpiryJob(
  connection: ConnectionOptions,
  expireOld: () => Promise<number>,
  onDone: (expired: number) => void = () => {},
) {
  const queue = new Queue(QUEUE, { connection });
  const worker = new Worker(QUEUE, async () => onDone(await expireOld()), { connection });
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: "0 3 * * *", tz: "UTC" },
    { name: SCHEDULER_ID, opts: { removeOnComplete: true, removeOnFail: { age: 86_400 } } },
  );
  return {
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
