// Stores session tokens only as a SHA-256 fingerprint (AC-F01-33, D048). Better Auth 1.7 saves tokens
// readable and looks sessions up by token, so this wrapper sits between Better Auth and the database:
// tokens are fingerprinted on the way in, and a session found by its token is handed back with that
// real token (Better Auth re-sends it when it refreshes a session). Someone who reads the database
// can't use what they find to sign in.
import { createHash } from "node:crypto";

interface Clause {
  field: string;
  value: unknown;
  operator?: string;
  connector?: string;
}

type Row = Record<string, unknown>;

/** The adapter methods this wrapper changes; every other member of the real adapter is kept as is. */
export interface MinimalAdapter {
  create: <R>(data: { model: string; data: Row; select?: string[] }) => Promise<R>;
  findOne: <T>(data: { model: string; where: Clause[]; select?: string[] }) => Promise<T | null>;
  findMany: <T>(data: { model: string; where?: Clause[]; limit?: number }) => Promise<T[]>;
  update: <T>(data: { model: string; where: Clause[]; update: Row }) => Promise<T | null>;
  updateMany: (data: { model: string; where: Clause[]; update: Row }) => Promise<number>;
  delete: <T>(data: { model: string; where: Clause[] }) => Promise<T | undefined>;
  deleteMany: (data: { model: string; where: Clause[] }) => Promise<number>;
  count: (data: { model: string; where?: Clause[] }) => Promise<number>;
  consumeOne: <T>(data: { model: string; where: Clause[] }) => Promise<T | null>;
}

const SESSION = "session";

function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashValue(value: unknown): unknown {
  if (typeof value === "string") return fingerprint(value);
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? fingerprint(item) : item));
  return value;
}

function hashWhere(model: string, where: Clause[] | undefined): Clause[] | undefined {
  if (model !== SESSION || where === undefined) return where;
  return where.map((clause) => (clause.field === "token" ? { ...clause, value: hashValue(clause.value) } : clause));
}

function hashRow(model: string, row: Row): Row {
  if (model !== SESSION || typeof row["token"] !== "string") return row;
  return { ...row, token: fingerprint(row["token"]) };
}

/** The real token the caller looked up by, if any (an exact match on "token"). */
function tokenIn(where: Clause[] | undefined): string | undefined {
  const clause = where?.find((item) => item.field === "token" && (item.operator ?? "eq") === "eq");
  return typeof clause?.value === "string" ? clause.value : undefined;
}

function withToken<T>(model: string, result: T, token: string | undefined): T {
  if (model !== SESSION || token === undefined || result === null || typeof result !== "object") return result;
  return { ...result, token };
}

/** `where`, only when there is one (the adapter's options must not contain an empty key). */
function optionalWhere(where: Clause[] | undefined): { where?: Clause[] } {
  return where === undefined ? {} : { where };
}

/** Wraps a Better Auth database adapter (any object with the MinimalAdapter methods). */
export function hashSessionTokens<A extends object>(real: A): A {
  const adapter = real as unknown as MinimalAdapter;
  const wrapped: MinimalAdapter = {
    create: async <R>(data: { model: string; data: Row; select?: string[] }): Promise<R> => {
      const plain = data.data["token"];
      const created = await adapter.create<R>({ ...data, data: hashRow(data.model, data.data) });
      return withToken(data.model, created, typeof plain === "string" ? plain : undefined);
    },
    findOne: async (data) =>
      withToken(
        data.model,
        await adapter.findOne({ ...data, where: hashWhere(data.model, data.where) ?? [] }),
        tokenIn(data.where),
      ),
    findMany: async (data) => adapter.findMany({ ...data, ...optionalWhere(hashWhere(data.model, data.where)) }),
    update: async (data) =>
      withToken(
        data.model,
        await adapter.update({
          ...data,
          where: hashWhere(data.model, data.where) ?? [],
          update: hashRow(data.model, data.update),
        }),
        tokenIn(data.where),
      ),
    updateMany: async (data) =>
      adapter.updateMany({
        ...data,
        where: hashWhere(data.model, data.where) ?? [],
        update: hashRow(data.model, data.update),
      }),
    delete: async (data) => adapter.delete({ ...data, where: hashWhere(data.model, data.where) ?? [] }),
    deleteMany: async (data) => adapter.deleteMany({ ...data, where: hashWhere(data.model, data.where) ?? [] }),
    count: async (data) => adapter.count({ ...data, ...optionalWhere(hashWhere(data.model, data.where)) }),
    consumeOne: async (data) =>
      withToken(
        data.model,
        await adapter.consumeOne({ ...data, where: hashWhere(data.model, data.where) ?? [] }),
        tokenIn(data.where),
      ),
  };
  // Work done inside a database transaction gets a wrapped transaction adapter too.
  const transaction = (real as { transaction?: (run: (tx: object) => Promise<unknown>) => Promise<unknown> })
    .transaction;
  const withTransaction =
    transaction === undefined
      ? {}
      : { transaction: (run: (tx: object) => Promise<unknown>) => transaction((tx) => run(hashSessionTokens(tx))) };
  return { ...real, ...wrapped, ...withTransaction } as A;
}
