// Which Google/Microsoft buttons to show: only providers with keys in the backend's settings (AC-F01-07).
// Unknown (backend not reachable yet) means none; email sign-in always works.
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { providersResponseSchema } from "@meetapp/contracts";
import { apiRequest } from "../api/index.ts";

type Providers = z.infer<typeof providersResponseSchema>;
const NONE: Providers = { google: false, microsoft: false };

export function useProviders(): Providers {
  const query = useQuery({
    queryKey: ["sign-in-providers"],
    queryFn: () => apiRequest<Providers>("/api/v1/auth/providers"),
    staleTime: 5 * 60 * 1_000,
  });
  return query.data ?? NONE;
}
