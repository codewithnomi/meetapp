// Settings → Notifications (F04 AC-F04-36): the five switches, kept on the account. While they can't be
// loaded, all are on (the defaults) and loading is tried again; a change applies at once.
import type { NotificationSettings } from "@meetapp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/index.ts";

const ALL_ON: NotificationSettings = { messages: true, mentions: true, lobby: true, sound: true, preview: true };
const KEY = ["me", "notification-settings"];
const URL = "/api/v1/me/notification-settings";
/** Tries again every 30 seconds after a failure. */
const RETRY_MS = 30_000;

export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<NotificationSettings>(URL),
    retry: true,
    retryDelay: RETRY_MS,
  });
  const change = useMutation({
    mutationFn: (one: Partial<NotificationSettings>) =>
      apiRequest<NotificationSettings>(URL, { method: "PUT", body: one }),
    onMutate: (one) => {
      const before = queryClient.getQueryData<NotificationSettings>(KEY);
      queryClient.setQueryData(KEY, { ...(before ?? ALL_ON), ...one });
      return before;
    },
    onError: (_error, _one, before) => queryClient.setQueryData(KEY, before),
    onSuccess: (saved) => queryClient.setQueryData(KEY, saved),
  });
  return {
    settings: query.data ?? ALL_ON,
    loaded: query.data !== undefined,
    failed: change.isError,
    change: (one: Partial<NotificationSettings>) => change.mutate(one),
  };
}
