// Reads the feature switches from the backend (GET /api/v1/flags). Any problem (backend down, an
// error answer, unexpected data) gives an empty list, so every feature counts as off (AC-F00-34).
import { flagsResponseSchema } from "@meetapp/contracts";

export type FlagMap = Record<string, boolean>;

export const API_URL: string = import.meta.env["VITE_API_URL"] ?? "http://127.0.0.1:3000";

export async function fetchFlags(
  apiUrl: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<FlagMap> {
  try {
    const response = await fetcher(`${apiUrl}/api/v1/flags`, signal ? { signal } : {});
    if (!response.ok) return {};
    const parsed = flagsResponseSchema.safeParse(await response.json());
    if (!parsed.success) return {};
    return Object.fromEntries(parsed.data.map((flag) => [flag.key, flag.enabled]));
  } catch {
    return {};
  }
}
