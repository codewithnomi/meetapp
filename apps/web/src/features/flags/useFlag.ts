// useFlag("key"): is this feature switched on? Asks the backend again every 15 seconds, so switching a
// flag off hides the feature within 30 seconds without a restart. Off until known; unknown = off.
import { useEffect, useState } from "react";
import { API_URL, fetchFlags } from "./flags-api.ts";

export const FLAG_REFRESH_MS = 15_000;

export interface FlagOptions {
  apiUrl?: string;
  fetcher?: typeof fetch;
  intervalMs?: number;
}

export function useFlag(key: string, options: FlagOptions = {}): boolean {
  const { apiUrl = API_URL, fetcher = fetch, intervalMs = FLAG_REFRESH_MS } = options;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async (): Promise<void> => {
      const flags = await fetchFlags(apiUrl, fetcher, controller.signal);
      if (!controller.signal.aborted) setEnabled(flags[key] === true);
    };
    void refresh();
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [key, apiUrl, fetcher, intervalMs]);

  return enabled;
}
