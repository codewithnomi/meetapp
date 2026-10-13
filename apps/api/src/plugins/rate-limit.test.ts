// TC-F01-33, 34, 35 (AC-F01-13, security rule S5): fixed-window counters, the same for every email
// whether or not it has an account, stored under a keyed fingerprint (HMAC) and never the plain email.
import { describe, expect, it } from "vitest";
import { RATE_RULES, createRateLimiter, type CounterStore } from "./rate-limit.ts";

// Obviously fake and low in randomness, so the secrets scanner doesn't mistake it for a real key.
const TEST_SECRET = "test-key-" + "x".repeat(32);

function memoryStore() {
  const values = new Map<string, number>();
  const store: CounterStore = {
    incr: async (key) => {
      const next = (values.get(key) ?? 0) + 1;
      values.set(key, next);
      return next;
    },
    get: async (key) => {
      const value = values.get(key);
      return value === undefined ? null : String(value);
    },
    pexpire: async () => 1,
    decr: async (key) => {
      const next = (values.get(key) ?? 0) - 1;
      values.set(key, next);
      return next;
    },
    del: async (key) => Number(values.delete(key)),
  };
  return { values, store };
}

function limiterAt(clock: { now: number }, store: CounterStore) {
  return createRateLimiter({ store, secret: TEST_SECRET, now: () => clock.now });
}

describe("TC-F01-33 [AC-F01-13] wrong passwords per email", () => {
  it("TC-F01-33 [AC-F01-13] 5 failures are allowed; then the email waits until the 15-minute window ends", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const { store } = memoryStore();
    const limiter = limiterAt(clock, store);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(await limiter.take(RATE_RULES.wrongPassword, "a@example.test")).toBeUndefined();
    }
    expect(await limiter.blocked(RATE_RULES.wrongPassword, "a@example.test")).toBe(15 * 60);
    expect(await limiter.take(RATE_RULES.wrongPassword, "a@example.test")).toBe(15 * 60);
    clock.now += 15 * 60 * 1_000;
    expect(await limiter.blocked(RATE_RULES.wrongPassword, "a@example.test")).toBeUndefined();
  });

  it("TC-F01-33 [AC-F01-13] letter case and spaces in the email don't give extra tries", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    for (const email of ["A@example.test", " a@example.test", "a@EXAMPLE.test", "a@example.test ", "a@example.test"]) {
      await limiter.take(RATE_RULES.wrongPassword, email);
    }
    expect(await limiter.blocked(RATE_RULES.wrongPassword, "a@example.test")).toBeGreaterThan(0);
  });
});

describe("TC-F01-33 [AC-F01-13] counted before the check, given back when right", () => {
  it("TC-F01-33 [AC-F01-13] a right password gives its count back, so only wrong ones add up", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    for (let attempt = 1; attempt <= 20; attempt++) {
      expect(await limiter.take(RATE_RULES.wrongPassword, "b@example.test")).toBeUndefined();
      await limiter.refund(RATE_RULES.wrongPassword, "b@example.test");
    }
    expect(await limiter.blocked(RATE_RULES.wrongPassword, "b@example.test")).toBeUndefined();
  });

  it("TC-F01-33 [AC-F01-13] tries sent at the same moment are all counted: only 5 get through", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    const verdicts = await Promise.all(
      Array.from({ length: 50 }, () => limiter.take(RATE_RULES.wrongPassword, "c@example.test")),
    );
    expect(verdicts.filter((wait) => wait === undefined)).toHaveLength(5);
  });
});

describe("TC-F01-34 [AC-F01-13] code emails per address and sign-ups per network address", () => {
  it("TC-F01-34 [AC-F01-13] the 6th code email in an hour is refused; another email is not affected", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 30, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    for (let request = 1; request <= 5; request++) {
      expect(await limiter.take(RATE_RULES.codeEmails, "b@example.test")).toBeUndefined();
    }
    expect(await limiter.take(RATE_RULES.codeEmails, "b@example.test")).toBe(30 * 60);
    expect(await limiter.take(RATE_RULES.codeEmails, "c@example.test")).toBeUndefined();
  });

  it("TC-F01-34 [AC-F01-13] the 51st sign-up from one network address in an hour is refused", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    for (let signUp = 1; signUp <= 50; signUp++) {
      expect(await limiter.take(RATE_RULES.signUps, "203.0.113.7")).toBeUndefined();
    }
    expect(await limiter.take(RATE_RULES.signUps, "203.0.113.7")).toBeGreaterThan(0);
    expect(await limiter.take(RATE_RULES.signUps, "203.0.113.8")).toBeUndefined();
  });
});

describe("TC-F01-44 [AC-F01-17] invitation emails per sender", () => {
  it("TC-F01-44 [AC-F01-17] the 51st in a day is refused, another sender is not affected, 24 hours later it works", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 0, 0, 0) };
    const limiter = limiterAt(clock, memoryStore().store);
    for (let sent = 1; sent <= 50; sent++) {
      expect(await limiter.take(RATE_RULES.invitationEmails, "sender-1")).toBeUndefined();
    }
    expect(await limiter.take(RATE_RULES.invitationEmails, "sender-1")).toBeGreaterThan(0);
    expect(await limiter.take(RATE_RULES.invitationEmails, "sender-2")).toBeUndefined();
    clock.now += 24 * 60 * 60 * 1_000;
    expect(await limiter.take(RATE_RULES.invitationEmails, "sender-1")).toBeUndefined();
  });
});

describe("TC-F01-35 [AC-F01-13] limits reveal nothing", () => {
  it("TC-F01-35 [AC-F01-13] counters are stored under an HMAC, never the plain email", async () => {
    const clock = { now: Date.UTC(2026, 9, 11, 10, 0, 0) };
    const { values, store } = memoryStore();
    const limiter = limiterAt(clock, store);
    await limiter.take(RATE_RULES.codeEmails, "secret.person@example.test");
    const keys = [...values.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("secret.person");
    expect(keys[0]).toMatch(/^rate:code-emails:[0-9a-f]{64}:\d+$/);
  });

  it("TC-F01-35 [AC-F01-13] when the counter store is down, requests are let through (and the problem is reported)", async () => {
    const problems: unknown[] = [];
    const broken: CounterStore = {
      incr: async () => Promise.reject(new Error("redis is down")),
      get: async () => Promise.reject(new Error("redis is down")),
      pexpire: async () => Promise.reject(new Error("redis is down")),
      decr: async () => Promise.reject(new Error("redis is down")),
      del: async () => Promise.reject(new Error("redis is down")),
    };
    const limiter = createRateLimiter({
      store: broken,
      secret: TEST_SECRET,
      onStoreError: (error) => problems.push(error),
    });
    expect(await limiter.take(RATE_RULES.codeEmails, "d@example.test")).toBeUndefined();
    expect(await limiter.blocked(RATE_RULES.wrongPassword, "d@example.test")).toBeUndefined();
    expect(problems).toHaveLength(2);
  });
});
