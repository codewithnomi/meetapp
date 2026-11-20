// A broken connection never stops the server: errors on idle and in-use connections are reported, never thrown.
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "./connection.ts";

describe("createDatabase", () => {
  it("reports an error on a connection in use instead of throwing it", async () => {
    const onPoolError = vi.fn();
    const { pool, close } = createDatabase("postgres://u:p@127.0.0.1:1/db", { onPoolError });
    const client = new EventEmitter();
    pool.emit("connect", client);
    const broken = new Error("Connection terminated unexpectedly");
    expect(() => client.emit("error", broken)).not.toThrow();
    expect(onPoolError).toHaveBeenCalledWith(broken);
    await close();
  });
});
