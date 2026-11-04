// Notification settings on the account (F04 design 4; AC-F04-36). Database access only.
import { type Database, user } from "@meetapp/db";
import type { NotificationSettings } from "@meetapp/contracts";
import { eq } from "drizzle-orm";

const COLUMNS = {
  messages: user.notifyMessages,
  mentions: user.notifyMentions,
  lobby: user.notifyLobby,
  sound: user.notifySound,
  preview: user.notifyPreview,
};
const FIELDS = {
  messages: "notifyMessages",
  mentions: "notifyMentions",
  lobby: "notifyLobby",
  sound: "notifySound",
  preview: "notifyPreview",
} as const;

export function createNotificationSettingsRepository(db: Database) {
  return {
    read: async (userId: string): Promise<NotificationSettings | undefined> =>
      (await db.select(COLUMNS).from(user).where(eq(user.id, userId)))[0],
    change: async (userId: string, change: { [K in keyof NotificationSettings]?: boolean | undefined }) => {
      const values = Object.fromEntries(
        Object.entries(change)
          .filter(([, on]) => on !== undefined)
          .map(([key, on]) => [FIELDS[key as keyof NotificationSettings], on]),
      );
      await db.update(user).set(values).where(eq(user.id, userId));
    },
  };
}

export type NotificationSettingsRepository = ReturnType<typeof createNotificationSettingsRepository>;
