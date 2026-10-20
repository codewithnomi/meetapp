// The screens' own calls to the backend (F01 design.md section 7, AC-F01-29). Every call gives up after
// 10 seconds, so a backend that doesn't answer shows "Can't reach MeetApp" with Retry instead of a
// spinner forever. In the desktop app, the main process adds the sign-in token to these requests.
import { API_URL } from "../flags/index.ts";

const TIME_LIMIT_MS = 10_000;

/** A refused or failed call: the backend's error code, or NETWORK_ERROR when it couldn't be reached. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: string, status: number, retryAfterSeconds?: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Sent as JSON; a Blob (e.g. a chosen photo file) is sent as it is. */
  body?: unknown;
  /** Extra headers, e.g. an Idempotency-Key when creating something (AC-F01-29). */
  headers?: Record<string, string>;
  apiUrl?: string;
  fetcher?: typeof fetch;
  /** How long to wait for an answer; 10 s unless a call needs longer (a photo upload). */
  timeoutMs?: number;
  /** Still sent when the window is closing (leaving a meeting as the app closes, F02). */
  keepalive?: boolean;
}

async function errorOf(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { code?: unknown; retryAfterSeconds?: unknown };
  };
  const code = typeof body.error?.code === "string" ? body.error.code : `HTTP_${String(response.status)}`;
  const retry = body.error?.retryAfterSeconds;
  return new ApiError(code, response.status, typeof retry === "number" ? retry : undefined);
}

function bodyAndType(body: unknown, headers: Record<string, string>): RequestInit {
  if (body === undefined) return { headers };
  if (body instanceof Blob) {
    return { body, headers: { ...headers, "content-type": body.type || "application/octet-stream" } };
  }
  return { body: JSON.stringify(body), headers: { ...headers, "content-type": "application/json" } };
}

/** The full address of a file the API serves, e.g. a photo's `/api/v1/users/<id>/avatar?v=…`. */
export const apiFileUrl = (path: string | null | undefined, apiUrl: string = API_URL): string | undefined =>
  path ? `${apiUrl}${path}` : undefined;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, apiUrl = API_URL, fetcher = fetch, timeoutMs = TIME_LIMIT_MS } = options;
  const keepalive = options.keepalive === true ? { keepalive: true } : {};
  let response: Response;
  try {
    response = await fetcher(`${apiUrl}${path}`, {
      method,
      ...bodyAndType(body, headers),
      signal: AbortSignal.timeout(timeoutMs),
      ...keepalive,
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", 0);
  }
  if (!response.ok) throw await errorOf(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
