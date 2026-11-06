// The job that ends a hand-set status when it runs out (F04 design 3.3; AC-F04-21). Each status gets a
// delayed job with a fixed id per person and end time, so setting it again doesn't stack runs; a job
// for a status changed meanwhile clears nothing (the status rule also ignores a run-out status on read).
import { Queue, Worker, type ConnectionOptions } from "bullmq";

const QUEUE = "status-expiry";

export async function startStatusExpiryJob(connection: ConnectionOptions, runOut: (userId: string) => Promise<void>) {
  const queue = new Queue(QUEUE, { connection });
  const worker = new Worker(QUEUE, async (job) => runOut((job.data as { userId: string }).userId), { connection });
  await queue.waitUntilReady();
  return {
    schedule: async (userId: string, at: Date): Promise<void> => {
      await queue.add(
        "run-out",
        { userId },
        {
          jobId: `${userId}-${at.getTime()}`,
          delay: Math.max(0, at.getTime() - Date.now()),
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    },
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
