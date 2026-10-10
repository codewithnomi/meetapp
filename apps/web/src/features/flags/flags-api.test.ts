// fetchFlags: TC-F00-74 (unknown flag, failed fetch, 503 or malformed reply all mean "off": an empty
// map, never an error) and the request it makes for TC-F00-72.
import { describe, expect, it, vi } from "vitest";
import { fetchFlags } from "./flags-api.ts";

const API = "http://api.test";

function reply(body: string, status = 200) {
  return vi.fn<typeof fetch>(
    async () => new Response(body, { status, headers: { "content-type": "application/json" } }),
  );
}

const json = (value: unknown, status = 200) => reply(JSON.stringify(value), status);

describe("fetchFlags", () => {
  it("TC-F00-72 [AC-F00-34] asks GET /api/v1/flags and turns the list into a key → on/off map", async () => {
    const fetcher = json([
      { key: "demo", enabled: true },
      { key: "beta", enabled: false },
    ]);
    await expect(fetchFlags(API, fetcher)).resolves.toEqual({ demo: true, beta: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${API}/api/v1/flags`);
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("TC-F00-72 [AC-F00-34] passes the abort signal on to the request", async () => {
    const fetcher = json([]);
    const controller = new AbortController();
    await fetchFlags(API, fetcher, controller.signal);
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("TC-F00-74 [AC-F00-34] an empty list gives an empty map", async () => {
    await expect(fetchFlags(API, json([]))).resolves.toEqual({});
  });

  it("TC-F00-74 [AC-F00-34] (b) a fetch that rejects gives an empty map", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(fetchFlags(API, fetcher)).resolves.toEqual({});
  });

  it.each([500, 503, 404, 401])("TC-F00-74 [AC-F00-34] (c) a %s reply gives an empty map", async (status) => {
    await expect(fetchFlags(API, json([{ key: "demo", enabled: true }], status))).resolves.toEqual({});
  });

  it.each([
    ["text that is not JSON", "<html>oops</html>"],
    ["an empty body", ""],
    ["an object instead of a list", JSON.stringify({ demo: true })],
    ["a wrong field type", JSON.stringify([{ key: "demo", enabled: "yes" }])],
    ["a missing key", JSON.stringify([{ enabled: true }])],
    ["null", "null"],
  ])("TC-F00-74 [AC-F00-34] (c) malformed reply (%s) gives an empty map", async (_name, body) => {
    await expect(fetchFlags(API, reply(body))).resolves.toEqual({});
  });
});
