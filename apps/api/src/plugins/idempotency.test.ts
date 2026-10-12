// AC-F01-29: a repeated create with the same Idempotency-Key gives the first result and does the work
// once, even when the copies arrive together; a failed first try can be repeated.
import { describe, expect, it } from "vitest";
import { createIdempotency, type IdempotencyStore } from "./idempotency.ts";

function memoryStore(): IdempotencyStore {
  const values = new Map<string, string>();
  return {
    claim: async (key, value) => (values.has(key) ? false : (values.set(key, value), true)),
    put: async (key, value) => values.set(key, value),
    get: async (key) => values.get(key) ?? null,
    del: async (key) => Number(values.delete(key)),
  };
}

const setUp = () =>
  createIdempotency({ store: memoryStore(), sleep: () => new Promise((done) => setTimeout(done, 1)) });

describe("TC-F01-40 [AC-F01-29] idempotency keys", () => {
  it("TC-F01-40 [AC-F01-29] the same key returns the first result and runs the work once", async () => {
    const { once } = setUp();
    let runs = 0;
    const work = async () => ({ id: `w${String(++runs)}` });
    expect(await once("user-1", "key-12345", work)).toEqual({ id: "w1" });
    expect(await once("user-1", "key-12345", work)).toEqual({ id: "w1" });
    expect(runs).toBe(1);
  });

  it("TC-F01-40 [AC-F01-29] copies arriving together wait for the first one's result", async () => {
    const { once } = setUp();
    let runs = 0;
    const work = async () => {
      runs += 1;
      await new Promise((done) => setTimeout(done, 20));
      return { id: "only" };
    };
    const results = await Promise.all([1, 2, 3].map(() => once("user-1", "key-parallel", work)));
    expect(results).toEqual([{ id: "only" }, { id: "only" }, { id: "only" }]);
    expect(runs).toBe(1);
  });

  it("TC-F01-40 [AC-F01-29] keys are per caller, no key means no memory, and a failure can be retried", async () => {
    const { once } = setUp();
    let runs = 0;
    const work = async () => ({ run: ++runs });
    await once("user-1", "shared-key", work);
    expect(await once("user-2", "shared-key", work)).toEqual({ run: 2 });
    expect(await once("user-1", undefined, work)).toEqual({ run: 3 });
    await expect(once("user-1", "fails-key", () => Promise.reject(new Error("refused")))).rejects.toThrow("refused");
    expect(await once("user-1", "fails-key", work)).toEqual({ run: 4 });
  });
});
