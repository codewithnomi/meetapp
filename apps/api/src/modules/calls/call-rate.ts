// The calls limit (F15 AC-F15-22, S5): a start counts 1 and each person rung by Add people counts 1; at
// most 10 a minute per person. A request that goes over is refused whole and its counts are given back.
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";

export async function takeCallUnits(limiter: RateLimiter, userId: string, units: number): Promise<void> {
  for (let taken = 1; taken <= units; taken += 1) {
    const wait = await limiter.take(RATE_RULES.chatCalls, userId);
    if (wait === undefined) continue;
    for (let back = 0; back < taken; back += 1) await limiter.refund(RATE_RULES.chatCalls, userId);
    throw new AppError(429, "CALL_RATE", "You're calling too often. Wait a moment.", wait);
  }
}
