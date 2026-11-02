// Where rings go (F15 T4; design.md 3.8; AC-F15-34): every target gets each ring and stop once, and a target
// that fails never stops the others.
import type { LineServerMessage, RingMessage } from "@meetapp/contracts";
import { describe, expect, it, vi } from "vitest";
import { allTargets, liveLineTarget, type RingTarget } from "./ring-targets.ts";

const ring: RingMessage = {
  t: "ring",
  callId: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  from: { userId: "33333333-3333-4333-8333-333333333333", name: "Ada", photoUrl: null },
  media: "video",
  groupName: null,
  expiresAt: "2030-01-01T00:00:30.000Z",
};

const fake = (): RingTarget & { ring: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } => ({
  ring: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
});

describe("ring targets", () => {
  it("TC-F15-45 [AC-F15-34] every target gets the ring and the stop exactly once", async () => {
    const toPerson = vi.fn<(userId: string, message: LineServerMessage) => Promise<void>>(() => Promise.resolve());
    const push = fake();
    const all = allTargets([liveLineTarget({ toPerson }), push]);
    await all.ring("u1", ring);
    await all.stop("u1", ring.callId, "accepted");
    expect(toPerson).toHaveBeenCalledTimes(2);
    expect(toPerson).toHaveBeenNthCalledWith(1, "u1", ring);
    expect(push.ring).toHaveBeenCalledTimes(1);
    expect(push.ring).toHaveBeenCalledWith("u1", ring);
    expect(push.stop).toHaveBeenCalledTimes(1);
    expect(push.stop).toHaveBeenCalledWith("u1", ring.callId, "accepted");
  });

  it("TC-F15-45 [AC-F15-34] a target that throws does not stop the other, and nothing is thrown", async () => {
    const broken: RingTarget = {
      ring: () => Promise.reject(new Error("push down")),
      stop: () => Promise.reject(new Error("push down")),
    };
    const good = fake();
    for (const order of [
      [broken, good],
      [good, broken],
    ]) {
      good.ring.mockClear();
      good.stop.mockClear();
      const all = allTargets(order);
      await expect(all.ring("u1", ring)).resolves.toBeUndefined();
      await expect(all.stop("u1", ring.callId, "declined")).resolves.toBeUndefined();
      expect(good.ring).toHaveBeenCalledTimes(1);
      expect(good.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("TC-F15-45 [AC-F15-34] the live line sends the ring as is and maps a stop to ring_stop", async () => {
    const toPerson = vi.fn<(userId: string, message: LineServerMessage) => Promise<void>>(() => Promise.resolve());
    const target = liveLineTarget({ toPerson });
    await target.ring("u1", ring);
    expect(toPerson).toHaveBeenLastCalledWith("u1", ring);
    for (const reason of ["accepted", "declined", "cancelled", "missed", "ended"] as const) {
      await target.stop("u2", ring.callId, reason);
      expect(toPerson).toHaveBeenLastCalledWith("u2", { t: "ring_stop", callId: ring.callId, reason });
    }
  });
});
