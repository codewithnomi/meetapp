// Test helper: a local fake Google and Microsoft (oauth2-mock-server, D049). Better Auth calls the real
// providers' fixed addresses, so this test process sends those calls to the fake instead; nothing else
// changes. `nextPerson` sets who the provider says signed in, and `photos` serves profile pictures.
import { Events, OAuth2Server } from "oauth2-mock-server";
import { vi } from "vitest";

const TOKEN_ADDRESSES = [
  "https://oauth2.googleapis.com/token",
  "https://login.microsoftonline.com/common/oauth2/v2.0/token",
];
const PROVIDER_PAGES = ["https://accounts.google.com/", "https://login.microsoftonline.com/"];

export interface FakeProviders {
  /** The claims of the next sign-in (sub, email, email_verified, name, picture, oid, tid, xms_edov…). */
  nextPerson: (claims: Record<string, unknown>) => void;
  /** Picture address → answer; any other https address the code fetches fails the test. */
  photos: Map<string, (init?: RequestInit) => Promise<Response> | Response>;
  /** The provider page Better Auth sent the browser to, answered by the fake: the redirect back. */
  approve: (providerPageUrl: string) => Promise<string>;
  stop: () => Promise<void>;
}

function addressOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

export async function startFakeProviders(): Promise<FakeProviders> {
  const server = new OAuth2Server();
  await server.issuer.keys.generate("RS256");
  await server.start(0, "127.0.0.1");
  const issuer = server.issuer.url ?? "";
  let person: Record<string, unknown> = {};
  server.service.on(Events.BeforeTokenSigning, (token: { payload: Record<string, unknown> }) => {
    Object.assign(token.payload, person);
  });
  const photos = new Map<string, (init?: RequestInit) => Promise<Response> | Response>();
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const address = addressOf(input);
    if (TOKEN_ADDRESSES.includes(address)) return realFetch(`${issuer}/token`, init);
    const photo = photos.get(address);
    if (photo) return photo(init);
    // Microsoft's own photo lookup during sign-in: "no photo" unless a test serves one.
    if (address.startsWith("https://graph.microsoft.com/")) return new Response(null, { status: 404 });
    if (address.startsWith("https://")) throw new Error(`Unexpected outside call in a test: ${address}`);
    return realFetch(input, init);
  });
  return {
    nextPerson: (claims) => {
      person = claims;
    },
    photos,
    approve: async (providerPageUrl) => {
      if (!PROVIDER_PAGES.some((page) => providerPageUrl.startsWith(page))) throw new Error(providerPageUrl);
      const query = new URL(providerPageUrl).search;
      const answer = await realFetch(`${issuer}/authorize${query}`, { redirect: "manual" });
      return answer.headers.get("location") ?? "";
    },
    stop: async () => {
      vi.unstubAllGlobals();
      await server.stop();
    },
  };
}
