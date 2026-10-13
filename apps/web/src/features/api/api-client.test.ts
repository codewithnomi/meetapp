// TC-F01-73 (AC-F01-29), the screens' part: backend errors keep their code; a backend that can't be
// reached, or answers too late, gives NETWORK_ERROR (and never hangs).
import { describe, expect, it } from "vitest";
import { ApiError, apiFileUrl, apiRequest } from "./api-client.ts";

const API = "http://api.test";

describe("apiRequest", () => {
  it("TC-F01-73 [AC-F01-29] answers with the body, sends JSON, and keeps the backend's error code", async () => {
    const seen: RequestInit[] = [];
    const ok = (async (_url: string, init: RequestInit) => {
      seen.push(init);
      return Response.json({ user: { name: "Pat" } });
    }) as unknown as typeof fetch;
    expect(await apiRequest("/api/v1/me/terms", { method: "POST", body: { a: 1 }, apiUrl: API, fetcher: ok })).toEqual({
      user: { name: "Pat" },
    });
    expect(seen[0]?.body).toBe('{"a":1}');

    const refused = (async () =>
      Response.json(
        { error: { code: "TOO_MANY_ATTEMPTS", retryAfterSeconds: 120 } },
        { status: 429 },
      )) as unknown as typeof fetch;
    await expect(apiRequest("/x", { apiUrl: API, fetcher: refused })).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it("TC-F01-73 [AC-F01-29] no connection, or no answer in time: NETWORK_ERROR", async () => {
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const error = await apiRequest("/x", { apiUrl: API, fetcher: down }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });

    const silent = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
      })) as unknown as typeof fetch;
    const started = Date.now();
    await expect(apiRequest("/x", { apiUrl: API, fetcher: silent })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(Date.now() - started).toBeLessThan(11_000);
  }, 15_000);

  it("TC-F01-66 [AC-F01-25] a file is sent as it is, with its own type; photo paths become full addresses", async () => {
    const seen: RequestInit[] = [];
    const ok = (async (_url: string, init: RequestInit) => {
      seen.push(init);
      return Response.json({ photoUrl: "/p" });
    }) as unknown as typeof fetch;
    const file = new Blob(["png bytes"], { type: "image/png" });
    await apiRequest("/api/v1/me/avatar", { method: "PUT", body: file, apiUrl: API, fetcher: ok });
    expect(seen[0]?.body).toBe(file);
    expect(seen[0]?.headers).toEqual({ "content-type": "image/png" });
    expect(apiFileUrl("/api/v1/users/u/avatar?v=1", API)).toBe("http://api.test/api/v1/users/u/avatar?v=1");
    expect(apiFileUrl(null, API)).toBeUndefined();
  });
});
