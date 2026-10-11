// useFlag: TC-F00-74 (unknown key, failed fetch, 503 or malformed reply = off) and TC-F00-72 at unit level
// (switching a flag off, then on, shows within one 15-second refresh, no restart needed).
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLAG_REFRESH_MS, useFlag } from "./useFlag.ts";

const API = "http://api.test";

type Reply = { status: number; body: string } | Error;

const on = (enabled: boolean): Reply => ({ status: 200, body: JSON.stringify([{ key: "demo", enabled }]) });

/** A fake fetch that answers with the given replies in order (the last one repeats). */
function replies(...list: Reply[]) {
  let call = 0;
  return vi.fn<typeof fetch>(async () => {
    const next = list[Math.min(call, list.length - 1)];
    call += 1;
    if (!next || next instanceof Error) throw next ?? new Error("no reply");
    return new Response(next.body, { status: next.status, headers: { "content-type": "application/json" } });
  });
}

/** Moves the fake clock forward and lets pending replies and React updates finish. */
async function wait(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderFlag(key: string, fetcher: typeof fetch, intervalMs?: number) {
  return renderHook(() => useFlag(key, { apiUrl: API, fetcher, ...(intervalMs ? { intervalMs } : {}) }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useFlag: off unless known to be on", () => {
  it("TC-F00-72 [AC-F00-34] refreshes every 15 seconds by default", () => {
    expect(FLAG_REFRESH_MS).toBe(15_000);
  });

  it("TC-F00-74 [AC-F00-34] is off before the first reply arrives, then on when the flag is on", async () => {
    const { result } = renderFlag("demo", replies(on(true)));
    expect(result.current).toBe(false);
    await wait();
    expect(result.current).toBe(true);
  });

  it("TC-F00-74 [AC-F00-34] asks the flags endpoint of the given API", async () => {
    const fetcher = replies(on(true));
    renderFlag("demo", fetcher);
    await wait();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(`${API}/api/v1/flags`);
  });

  it("TC-F00-74 [AC-F00-34] (a) a key not in the reply is off", async () => {
    const fetcher = replies(on(true));
    const { result } = renderHook(() => [
      useFlag("demo", { apiUrl: API, fetcher }),
      useFlag("not-a-flag", { apiUrl: API, fetcher }),
    ]);
    await wait();
    expect(result.current).toEqual([true, false]);
  });

  it.each([
    ["(b) the fetch rejects", new TypeError("Failed to fetch")],
    ["(c) the reply is 503", { status: 503, body: JSON.stringify([{ key: "demo", enabled: true }]) }],
    ["(c) the reply is not JSON", { status: 200, body: "<html>oops" }],
    ["(c) the reply has the wrong shape", { status: 200, body: JSON.stringify({ demo: true }) }],
  ] as [string, Reply][])("TC-F00-74 [AC-F00-34] %s: off", async (_name, failure) => {
    const fetcher = replies(failure);
    const { result } = renderFlag("demo", fetcher);
    await wait();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
  });

  it("TC-F00-74 [AC-F00-34] a flag that was on turns off when a later refresh fails", async () => {
    const { result } = renderFlag("demo", replies(on(true), new TypeError("Failed to fetch")));
    await wait();
    expect(result.current).toBe(true);
    await wait(FLAG_REFRESH_MS);
    expect(result.current).toBe(false);
  });
});

describe("useFlag: follows changes without a restart", () => {
  it("TC-F00-72 [AC-F00-34] on → off → on, each change seen at the next 15-second refresh", async () => {
    const fetcher = replies(on(true), on(false), on(true));
    const { result } = renderFlag("demo", fetcher);
    await wait();
    expect(result.current).toBe(true);
    await wait(FLAG_REFRESH_MS - 1_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
    await wait(1_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(false);
    await wait(FLAG_REFRESH_MS);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.current).toBe(true);
  });

  it("TC-F00-72 [AC-F00-34] uses a custom refresh interval when given", async () => {
    const fetcher = replies(on(false), on(true));
    const { result } = renderFlag("demo", fetcher, 1_000);
    await wait();
    expect(result.current).toBe(false);
    await wait(1_000);
    expect(result.current).toBe(true);
  });

  it("TC-F00-72 [AC-F00-34] stops asking once the screen using it is gone", async () => {
    const fetcher = replies(on(true));
    const { unmount } = renderFlag("demo", fetcher);
    await wait();
    unmount();
    await wait(FLAG_REFRESH_MS * 3);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
