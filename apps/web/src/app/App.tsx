// The app shell: the data cache, the router and the screens (F01 design.md section 1).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import { followSystemTheme } from "../features/appearance/index.ts";
import { AppRoutes } from "./router.tsx";

/** No automatic retries: a failed call shows its message and a Retry button instead (AC-F01-29). */
function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
