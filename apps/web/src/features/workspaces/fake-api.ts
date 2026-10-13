// Test helper (tests only): a stubbed backend for the signed-in screens. Answers are set per test by
// "METHOD path" (or just path for any method); every call is recorded with its parsed body.
import type { MeResponse } from "@meetapp/contracts";
import { vi } from "vitest";
import { PAT } from "../auth/fake-auth.tsx";

export const IDS = {
  personal: "00000000-0000-4000-8000-000000000001",
  aria: "00000000-0000-4000-8000-000000000002",
  north: "00000000-0000-4000-8000-000000000003",
};

const base = { pendingRequests: 0 };
export const ME = {
  user: PAT,
  currentWorkspaceId: IDS.aria,
  workspaces: [
    { ...base, id: IDS.personal, name: "x", kind: "personal", role: "owner" },
    { ...base, id: IDS.aria, name: "Aria", kind: "company", role: "owner", pendingRequests: 2 },
  ],
  supportEmail: "privacy@meetapp.test",
} as unknown as MeResponse;

export type Handler = (body: unknown) => Response | Promise<Response>;
interface ApiCall {
  method: string;
  path: string;
  body: unknown;
  /** What was sent, as sent (e.g. a photo file). */
  raw: BodyInit | null | undefined;
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
export const noContent = () => new Response(null, { status: 204 });
export const refuse = (code: string, status: number) => json({ error: { code } }, status);

/** Installs the stub; returns the handlers (change them in a test) and the recorded calls. */
export function fakeApi(initial: Record<string, Handler> = {}) {
  const calls: ApiCall[] = [];
  const handlers: Record<string, Handler> = {
    "/api/v1/me": () => json(ME),
    "/api/v1/me/last-workspace": noContent,
    ...initial,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body, raw: init.body });
      const handler = handlers[`${method} ${path}`] ?? handlers[path];
      return handler ? handler(body) : json({ error: { code: "NOT_FOUND" } }, 404);
    }),
  );
  const callsTo = (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path);
  return { handlers, calls, callsTo };
}
