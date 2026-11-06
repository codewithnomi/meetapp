// MeetApp's notification cards for new chat messages and mentions (F04 design 3.4; AC-F04-31, 32, 33):
// each new message on the live line goes through the card rules, and a card is sent to the desktop app
// (it checks and shows it). Clicking a card opens its chat. Signing out takes the cards away. Message text
// is never logged. Desktop app only.
import type { ConversationList, LineServerMessage, NoticeCard, NoticeChoice } from "@meetapp/contracts";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { apiFileUrl } from "../api/index.ts";
import { useSession } from "../auth/index.ts";
import { asDataUrl } from "../call-windows/photos.ts";
import { useChatCall } from "../calls/index.ts";
import { useTrayCommands } from "../desktop-app/index.ts";
import { useLiveLine } from "../chats/index.ts";
import { useNotificationSettings } from "../notifications/index.ts";
import { chime } from "./chime.ts";
import { Merger, decide, isQuiet, type ChatInfo } from "./notice-rules.ts";
import { chatInFront } from "./shown-chat.ts";

type NoticesBridge = { show: (card: NoticeCard) => void; remove: (cardId: string) => void };
type Bridge = {
  notices?: NoticesBridge;
  callWindows?: { onAction: (listener: (action: unknown) => void) => () => void };
};
const bridge = () => (window as { meetapp?: Bridge }).meetapp;

type News = Extract<LineServerMessage, { t: "news" }>;

/** The chat's name, muted state and picture from the chat lists already loaded. */
function chatInfo(queries: QueryClient, conversationId: string, senderId: string | null): ChatInfo | undefined {
  for (const [, list] of queries.getQueriesData<ConversationList>({ queryKey: ["chats"] })) {
    const item = list?.conversations?.find((c) => c.id === conversationId);
    if (!item) continue;
    const photo = item.people.find((p) => p.userId === senderId)?.photoUrl ?? null;
    return { title: item.title, kind: item.kind, muted: item.muted, photoUrl: photo };
  }
  return undefined;
}

function useOpenChosen(toChat: () => void, merger: Merger) {
  const openChat = useChatCall((state) => state.openChat);
  useEffect(
    () =>
      bridge()?.callWindows?.onAction((action) => {
        const chosen = action as { name?: string; cardId?: string; choice?: NoticeChoice };
        if (chosen.name !== "noticeChosen" || !chosen.cardId?.startsWith("chat:")) return;
        merger.closed(chosen.cardId);
        if (chosen.choice !== "open") return;
        openChat(chosen.cardId.split(":")[1] ?? "");
        toChat();
      }),
    [merger, openChat, toChat],
  );
}

type Words = (
  key: "notices.newMessages" | "notices.newMessage" | "notices.mentioned" | "notices.close",
  options?: { count: number },
) => string;

interface Now {
  t: Words;
  me: { id: string } | null | undefined;
  settings: ReturnType<typeof useNotificationSettings>["settings"];
  serverNow: () => number;
}

/** One new message: the card rules, then a new card (with its chime) or the chat's showing card updated. */
async function show(news: News, now: Now, queries: QueryClient, merger: Merger): Promise<void> {
  const message = news.event.message;
  if (!message || !now.me) return;
  const chat = chatInfo(queries, news.conversationId, message.sender.userId);
  const decision = decide({
    conversationId: news.conversationId,
    message,
    chat,
    me: now.me.id,
    shownChat: chatInFront(),
    settings: now.settings,
    serverNow: now.serverNow(),
    // The person's own status as the server gave it to the picture menu (read again every 15 seconds).
    quiet: isQuiet(
      queries.getQueryData<{ chosen: string | null; until: string | null }>(["me", "status"]),
      now.serverNow(),
    ),
  });
  if (!decision.show) return;
  const { t, settings } = now;
  const merged = merger.add(news.conversationId, Date.now());
  const many = merged.count > 1 ? t("notices.newMessages", { count: merged.count }) : undefined;
  const chatName = chat?.kind === "direct" ? undefined : chat?.title;
  const photoUrl = apiFileUrl(chat?.photoUrl);
  const photo = photoUrl ? await asDataUrl(photoUrl).catch(() => undefined) : undefined;
  const card: NoticeCard = {
    id: merged.cardId,
    kind: decision.mention ? "mention" : "message",
    title: message.sender.name,
    ...((chatName ?? many) ? { detail: [chatName, many].filter(Boolean).join(" · ") } : {}),
    // Preview off: the words of the message never leave this page (AC-F04-55).
    ...(decision.mention && !settings.preview
      ? {}
      : { text: settings.preview ? (decision.text ?? t("notices.newMessage")) : t("notices.newMessage") }),
    ...(decision.mention ? { tag: t("notices.mentioned") } : {}),
    person: { name: message.sender.name, initials: "", ...(photo ? { photo } : {}) },
    close: t("notices.close"),
  };
  bridge()?.notices?.show(card);
  if (merged.fresh && settings.sound) chime();
}

export function useNotices({ toChat }: { toChat: () => void }): void {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const { data: me } = useSession();
  const { settings } = useNotificationSettings();
  const merger = useRef(new Merger()).current;
  const lineRef = useRef<{ serverNow: () => number } | undefined>(undefined);
  const words: Words = (key, options) => t(key, options ?? {});
  const latest = useRef<Now>({ t: words, me, settings, serverNow: Date.now });
  latest.current = { t: words, me, settings, serverNow: () => lineRef.current?.serverNow() ?? Date.now() };
  useOpenChosen(toChat, merger);
  useTrayCommands({
    onStillRunning: (where) =>
      bridge()?.notices?.show({
        id: "still-running",
        kind: "running",
        title: t("notices.running.title"),
        text: t(where === "tray" ? "notices.running.tray" : "notices.running.menuBar"),
        close: t("notices.close"),
      }),
  });
  // Signed out (this part goes): the cards go too (AC-F04-95).
  useEffect(() => () => merger.cardIds().forEach((id) => bridge()?.notices?.remove(id)), [merger]);
  const listener = useRef((message: LineServerMessage | { t: "connected" }) => {
    if (message.t !== "news" || message.event.type !== "message_created") return;
    void show(message, latest.current, queries, merger);
  }).current;
  lineRef.current = useLiveLine(listener);
}
