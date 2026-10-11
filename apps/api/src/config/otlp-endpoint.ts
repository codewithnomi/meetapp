// Where the backend may send its traces and logs (security review, F00; rule S6): only to this
// computer, or to any address over https. Kept free of other imports: instrumentation.ts loads it
// before anything else, and config.ts uses the same rule to refuse a wrong setting at start-up.
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isAllowedOtlpEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
}
