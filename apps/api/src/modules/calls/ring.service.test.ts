// Accepting a ring whose join then fails (T-fix-3): the ring sounds again and nothing is stopped, so the
// person can try again; a join that works stops every window's ring.
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../plugins/errors.ts";
import { createRingService } from "./ring.service.ts";
import type { RingDeps } from "./ring.types.ts";

const CALL = { id: "call-1", conversationId: "chat-1" };
const RING = { id: "ring-1", callId: "call-1", userId: "mo", state: "ringing" };

function fakeDeps(join: RingDeps["join"]) {
  const chatCalls = {
    byId: vi.fn(async () => CALL),
    ringOf: vi.fn(async () => RING),
    stopRing: vi.fn(async () => [RING]),
    reopenRing: vi.fn(async () => undefined),
    starterOf: vi.fn(async () => ({ userId: "olivia", name: "Olivia" })),
  };
  const targets = { ring: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
  const deps = {
    chatCalls,
    targets,
    join,
    place: vi.fn(async () => ({})),
    calls: { now: () => new Date("2026-10-28T10:00:00Z") },
    missed: vi.fn(async () => undefined),
  } as unknown as RingDeps;
  return { deps, chatCalls, targets };
}

describe("accept", () => {
  it("T-fix-3 [AC-F15-06] a join that fails puts the ring back and stops nothing", async () => {
    const { deps, chatCalls, targets } = fakeDeps(async () => {
      throw new AppError(409, "CALL_FULL", "This call is full.");
    });
    await expect(createRingService(deps).accept("mo", "call-1")).rejects.toMatchObject({ code: "CALL_FULL" });
    expect(chatCalls.reopenRing).toHaveBeenCalledWith("ring-1");
    expect(targets.stop).not.toHaveBeenCalled();
  });

  it("T-fix-3 [AC-F15-06] a join that works stops the ring in every window and the caller's Calling screen", async () => {
    const joined = { attendanceId: "seat-1" };
    const { deps, chatCalls, targets } = fakeDeps(vi.fn(async () => joined) as unknown as RingDeps["join"]);
    await expect(createRingService(deps).accept("mo", "call-1")).resolves.toBe(joined);
    expect(chatCalls.reopenRing).not.toHaveBeenCalled();
    expect(targets.stop).toHaveBeenCalledWith("mo", "call-1", "accepted");
    expect(targets.stop).toHaveBeenCalledWith("olivia", "call-1", "accepted");
  });
});
