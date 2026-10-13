// The app shell: the data cache, the router and the screens (F01 design.md section 1).
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import { ApiError } from "../features/api/index.ts";
import { followSystemTheme } from "../features/appearance/index.ts";
import { SESSION_KEY } from "../features/auth/index.ts";
import { AppRoutes } from "./router.tsx";

/** A 401 from any screen's call means the session may have ended: ask main again (F01 design.md section 4). */
function recheckSessionOn401(client: QueryClient) {
  return (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) void client.invalidateQueries({ queryKey: SESSION_KEY });
  };
}

/** No automatic retries: a failed call shows its message and a Retry button instead (AC-F01-29). */
function newQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    queryCache: new QueryCache({ onError: (error) => recheckSessionOn401(client)(error) }),
    mutationCache: new MutationCache({ onError: (error) => recheckSessionOn401(client)(error) }),
  });
  return client;
}

export function App() {
  const [queryClient] = useState(newQueryClient);
  useEffect(() => followSystemTheme(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
