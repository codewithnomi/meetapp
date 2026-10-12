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
  body?: unknown;
  apiUrl?: string;
  fetcher?: typeof fetch;
}

async function errorOf(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { code?: unknown; retryAfterSeconds?: unknown };
  };
  const code = typeof body.error?.code === "string" ? body.error.code : `HTTP_${String(response.status)}`;
  const retry = body.error?.retryAfterSeconds;
  return new ApiError(code, response.status, typeof retry === "number" ? retry : undefined);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, apiUrl = API_URL, fetcher = fetch } = options;
  let response: Response;
  try {
    response = await fetcher(`${apiUrl}${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
      signal: AbortSignal.timeout(TIME_LIMIT_MS),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", 0);
  }
  if (!response.ok) throw await errorOf(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
