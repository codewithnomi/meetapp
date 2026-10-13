// TC-F01-81, 82 (AC-F01-33): invitation and join links carry their secret in the address itself, and
// the desktop sign-in its request id in the query; logs and traces record neither.
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { httpInstrumentationConfig } from "../observability/telemetry.ts";
import { redactPath, redactUrl } from "./logging.ts";

type Span = Parameters<NonNullable<ReturnType<typeof httpInstrumentationConfig>["requestHook"]>>[0];

const LINK_PART = "fake-link-part-for-tests";

describe("secret parts of addresses", () => {
  it("TC-F01-81 [AC-F01-33] the invitation or join secret in the path is hidden; other paths stay", () => {
    expect(redactPath(`/invite/${LINK_PART}`)).toBe("/invite/REDACTED");
    expect(redactPath(`/join/${LINK_PART}?x=1`)).toBe("/join/REDACTED?x=1");
    expect(redactPath("/api/v1/workspaces/abc/invitations")).toBe("/api/v1/workspaces/abc/invitations");
    expect(redactPath("/invite")).toBe("/invite");
  });

  it("TC-F01-81 [AC-F01-33] the desktop sign-in request id and codes in the query are hidden too", () => {
    const url = redactUrl(`/api/v1/auth/desktop/start?request=${LINK_PART}&error=cancelled`);
    expect(url).toBe("/api/v1/auth/desktop/start?request=REDACTED&error=cancelled");
    expect(redactUrl(`/api/auth/callback/google?code=${LINK_PART}&state=${LINK_PART}`)).not.toContain(LINK_PART);
  });

  it("TC-F01-82 [AC-F01-33] traces: the address attributes of an invitation page request are rewritten", () => {
    const attributes: Record<string, unknown> = {};
    const span = { setAttribute: (name: string, value: unknown) => (attributes[name] = value) } as unknown as Span;
    const hook = httpInstrumentationConfig().requestHook;
    hook?.(span, { url: `/invite/${LINK_PART}?lang=en` } as IncomingMessage);
    expect(JSON.stringify(attributes)).not.toContain(LINK_PART);
    expect(attributes["url.path"]).toBe("/invite/REDACTED");
    expect(attributes["http.target"]).toBe("/invite/REDACTED?lang=en");

    const untouched: Record<string, unknown> = {};
    const other = { setAttribute: (name: string, value: unknown) => (untouched[name] = value) } as unknown as Span;
    hook?.(other, { url: "/api/v1/me" } as IncomingMessage);
    expect(untouched).toEqual({});
  });
});
