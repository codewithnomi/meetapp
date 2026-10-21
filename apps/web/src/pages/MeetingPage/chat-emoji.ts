// The emoji picker's words and the recently used emoji (F03), shared by the message box and reactions.
import { useState } from "react";
import { useTranslation } from "react-i18next";

const RECENT_KEY = "meetapp.chat.recentEmoji";
const MAX_RECENT = 8;

/** Recently used emoji, kept on this computer only (a per-viewer convenience). */
function useRecentEmoji() {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT)
        : [];
    } catch {
      return [];
    }
  });
  const used = (emoji: string) => {
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, MAX_RECENT);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Not saved: the list still works for this session.
    }
  };
  return { recent, used };
}

/** The emoji picker's words and the recently used emoji. */
export function useEmojiSettings() {
  const { t } = useTranslation();
  const emoji = useRecentEmoji();
  return {
    used: emoji.used,
    settings: {
      dataUrl: "/emojibase",
      recent: emoji.recent,
      labels: {
        search: t("meetings.chat.emojiSearch"),
        recent: t("meetings.chat.emojiRecent"),
        loading: t("meetings.chat.emojiLoading"),
        empty: t("meetings.chat.emojiEmpty"),
        skinTone: t("meetings.chat.skinTone"),
      },
    },
  };
}
