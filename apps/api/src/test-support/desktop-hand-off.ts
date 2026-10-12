// Test helper: plays the desktop app and the computer's browser in a Google/Microsoft hand-off
// (F01 design.md section 4), against the fake providers in fake-providers.ts.
import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { FakeProviders } from "./fake-providers.ts";

/** A browser's cookie jar: keeps what the backend sets and sends it back. */
export class TestBrowser {
  private readonly jar = new Map<string, string>();

  keep(response: LightMyRequestResponse): void {
    const header = response.headers["set-cookie"];
    for (const cookie of Array.isArray(header) ? header : header === undefined ? [] : [header]) {
      const [pair = "", ...flags] = cookie.split(";");
      const [name = "", ...value] = pair.split("=");
      const gone = value.join("") === "" || flags.some((flag) => /max-age=0\b/i.test(flag.trim()));
      if (gone) this.jar.delete(name.trim());
      else this.jar.set(name.trim(), value.join("="));
    }
  }

  get cookie(): string {
    return [...this.jar].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

export interface HandOff {
  requestId: string;
  matchCode: string;
  startUrl: string;
  verifier: string;
}

const pathOf = (address: string) => {
  const url = new URL(address);
  return url.pathname + url.search;
};

/** The app's first step: a secret verifier, and only its SHA-256 sent. */
export async function initHandOff(app: FastifyInstance, provider: "google" | "microsoft"): Promise<HandOff> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/desktop/init",
    payload: { provider, challenge },
    // Each hand-off from its own address, as separate computers would be: the 20-an-hour start limit
    // per address is tested on its own (join-limits.integration.test.ts).
    remoteAddress: `10.${[0, 0, 0].map(() => String(randomBytes(1)[0] ?? 0)).join(".")}`,
  });
  if (response.statusCode !== 200) throw new Error(`init answered ${String(response.statusCode)}`);
  return { ...response.json<Omit<HandOff, "verifier">>(), verifier };
}

/**
 * The browser opens the start link, signs in at the fake provider as `person`, and lands on our page.
 * `extraQuery` is added to the address of our page (e.g. "&error=access_denied").
 */
export async function throughProvider(
  { app, fake, extraQuery = "" }: { app: FastifyInstance; fake: FakeProviders; extraQuery?: string },
  browser: TestBrowser,
  requestId: string,
  person: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  const start = await app.inject({
    url: `/api/v1/auth/desktop/start?request=${requestId}`,
    headers: { cookie: browser.cookie },
  });
  browser.keep(start);
  if (start.statusCode !== 302) return start;
  fake.nextPerson(person);
  const back = new URL(await fake.approve(String(start.headers.location)));
  back.searchParams.delete("iss");
  const callback = await app.inject({ url: back.pathname + back.search, headers: { cookie: browser.cookie } });
  browser.keep(callback);
  const done = await app.inject({
    url: pathOf(String(callback.headers.location)) + extraQuery,
    headers: { cookie: browser.cookie },
  });
  browser.keep(done);
  return done;
}

/** The person presses Continue or Cancel on our page. */
export function pressOnPage(
  app: FastifyInstance,
  browser: TestBrowser,
  requestId: string,
  action: "continue" | "cancel",
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/desktop/done",
    payload: `request=${requestId}&action=${action}`,
    headers: { cookie: browser.cookie, "content-type": "application/x-www-form-urlencoded" },
  });
}

/** The app asks for its session. */
export function exchange(app: FastifyInstance, handOff: Pick<HandOff, "requestId" | "verifier">) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/desktop/exchange",
    payload: { requestId: handOff.requestId, verifier: handOff.verifier },
  });
}
