// TC-F01-83 (AC-F01-33): session tokens reach the database only as a SHA-256 fingerprint, while Better
// Auth keeps working with the real token (D048, design.md "Verify at build" item 4).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSessionTokens, type MinimalAdapter } from "./auth-adapter.ts";

const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fake database adapter that remembers what was stored and filters by simple equality. */
function fakeAdapter() {
  const rows: Record<string, unknown>[] = [];
  const matches = (row: Record<string, unknown>, where: { field: string; value: unknown }[] = []) =>
    where.every((clause) => row[clause.field] === clause.value);
  const adapter: MinimalAdapter = {
    create: async ({ data }) => {
      const row = { id: `s${String(rows.length + 1)}`, ...data };
      rows.push(row);
      return row as never;
    },
    findOne: async ({ where }) => (rows.find((row) => matches(row, where)) ?? null) as never,
    findMany: async ({ where }) => rows.filter((row) => matches(row, where)) as never,
    update: async ({ where, update }) => {
      const row = rows.find((candidate) => matches(candidate, where));
      if (!row) return null;
      Object.assign(row, update);
      return row as never;
    },
    updateMany: async () => 0,
    delete: async ({ where }) => {
      const index = rows.findIndex((row) => matches(row, where));
      if (index >= 0) rows.splice(index, 1);
    },
    deleteMany: async () => 0,
    count: async () => rows.length,
    consumeOne: async () => null,
  };
  return { rows, adapter };
}

describe("TC-F01-83 [AC-F01-33] session tokens are stored only as fingerprints", () => {
  it("TC-F01-83 [AC-F01-33] creating a session stores the fingerprint and hands back the real token", async () => {
    const { rows, adapter } = fakeAdapter();
    const wrapped = hashSessionTokens(adapter);
    const created = await wrapped.create<{ token: string }>({ model: "session", data: { token: "real-token" } });
    expect(created.token).toBe("real-token");
    expect(rows[0]?.["token"]).toBe(fingerprint("real-token"));
    expect(JSON.stringify(rows)).not.toContain("real-token");
  });

  it("TC-F01-83 [AC-F01-33] looking a session up by its token finds it and returns the real token", async () => {
    const { adapter } = fakeAdapter();
    const wrapped = hashSessionTokens(adapter);
    await wrapped.create({ model: "session", data: { token: "real-token", userId: "u1" } });
    const found = await wrapped.findOne<{ token: string; userId: string }>({
      model: "session",
      where: [{ field: "token", value: "real-token" }],
    });
    expect(found).toMatchObject({ token: "real-token", userId: "u1" });
    expect(
      await wrapped.findOne({ model: "session", where: [{ field: "token", value: fingerprint("real-token") }] }),
    ).toBeNull();
  });

  it("TC-F01-83 [AC-F01-33] updating and deleting by token work on the fingerprint", async () => {
    const { rows, adapter } = fakeAdapter();
    const wrapped = hashSessionTokens(adapter);
    await wrapped.create({ model: "session", data: { token: "real-token", expiresAt: 1 } });
    const updated = await wrapped.update<{ token: string; expiresAt: number }>({
      model: "session",
      where: [{ field: "token", value: "real-token" }],
      update: { expiresAt: 2 },
    });
    expect(updated).toMatchObject({ token: "real-token", expiresAt: 2 });
    await wrapped.delete({ model: "session", where: [{ field: "token", value: "real-token" }] });
    expect(rows).toHaveLength(0);
  });

  it("TC-F01-83 [AC-F01-33] other tables are passed through unchanged", async () => {
    const { rows, adapter } = fakeAdapter();
    const wrapped = hashSessionTokens(adapter);
    await wrapped.create({ model: "verification", data: { token: "kept-as-is" } });
    expect(rows[0]?.["token"]).toBe("kept-as-is");
  });
});

describe("TC-F01-83 [AC-F01-33] sessions made inside a transaction", () => {
  it("TC-F01-83 [AC-F01-33] the transaction's adapter also stores only the fingerprint", async () => {
    const { rows, adapter } = fakeAdapter();
    const withTransactions = {
      ...adapter,
      transaction: async <R>(run: (tx: MinimalAdapter) => Promise<R>) => run(adapter),
    };
    const wrapped = hashSessionTokens(withTransactions);
    await wrapped.transaction(async (tx) => tx.create({ model: "session", data: { token: "in-transaction" } }));
    expect(rows[0]?.["token"]).toBe(fingerprint("in-transaction"));
  });
});
