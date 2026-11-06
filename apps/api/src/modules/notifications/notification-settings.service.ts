// Settings → Notifications (F04 AC-F04-36): the five switches, kept on the account, 20 changes a minute.
import type { NotificationSettings } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { NotificationSettingsRepository } from "./notification-settings.repository.ts";

const ALL_ON: NotificationSettings = { messages: true, mentions: true, lobby: true, sound: true, preview: true };

export function createNotificationSettingsService(deps: {
  settings: NotificationSettingsRepository;
  limiter: RateLimiter;
}) {
  const read = async (userId: string) => (await deps.settings.read(userId)) ?? ALL_ON;
  return {
    read,
    change: async (userId: string, change: { [K in keyof NotificationSettings]?: boolean | undefined }) => {
      const wait = await deps.limiter.take(RATE_RULES.notificationSettings, userId);
      if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many changes. Try again soon.", wait);
      await deps.settings.change(userId, change);
      return read(userId);
    },
  };
}

export type NotificationSettingsService = ReturnType<typeof createNotificationSettingsService>;
