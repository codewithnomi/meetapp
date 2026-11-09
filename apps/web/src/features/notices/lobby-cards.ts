// Lobby cards (F04 design 3.4; AC-F04-34), for a meeting the person is in and can let people in: each new
// person waiting gives "<name> is waiting in the lobby" with Admit and View lobby (a guest marked
// "Guest"); three or more give one "<n> people are waiting" card with View lobby. None while that meeting's
// window is in front, with lobby cards off, or on Do not disturb. Admit uses F02's own request, so the
// server checks the right as usual.
import type { NoticeCard } from "@meetapp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNotificationSettings } from "../notifications/index.ts";
import { windowInFront } from "./front.ts";
import { isQuiet } from "./notice-rules.ts";

export interface LobbyPerson {
  attendanceId: string;
  name: string;
  group: "member" | "external" | "guest";
}

export interface LobbyWords {
  waiting: string;
  many: (count: number) => string;
  guest: string;
  admit: string;
  viewLobby: string;
  close: string;
}

const MANY = 3;
export const MANY_ID = "lobby:many";

/** The cards for who is waiting now (TC-F04-60, 61). */
export function lobbyCards(waiting: LobbyPerson[], meeting: string, words: LobbyWords): NoticeCard[] {
  if (waiting.length >= MANY)
    return [
      {
        id: MANY_ID,
        kind: "lobby",
        title: words.many(waiting.length),
        detail: meeting,
        viewLobby: words.viewLobby,
        close: words.close,
      },
    ];
  return waiting.map((person) => ({
    id: `lobby:${person.attendanceId}`,
    kind: "lobby",
    title: person.name,
    ...(person.group === "guest" ? { tag: words.guest } : {}),
    text: words.waiting,
    detail: meeting,
    person: { name: person.name, initials: "" },
    admit: words.admit,
    viewLobby: words.viewLobby,
    close: words.close,
  }));
}

type Bridge = {
  notices?: { show: (card: NoticeCard) => void; remove: (cardId: string) => void };
  callWindows?: { onAction: (listener: (action: unknown) => void) => () => void };
};
const bridge = () => (window as { meetapp?: Bridge }).meetapp;

export interface LobbyCardsOptions {
  waiting: LobbyPerson[];
  meeting: string;
  admit: (attendanceId: string) => void;
  viewLobby: () => void;
}

/** Sends a card once per person (or once per count), and takes cards back when they are no longer true. */
export function useLobbyCards({ waiting, meeting, admit, viewLobby }: LobbyCardsOptions): void {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const { settings } = useNotificationSettings();
  const sent = useRef(new Map<string, string>());
  const actions = useRef({ admit, viewLobby });
  actions.current = { admit, viewLobby };
  const quiet = isQuiet(queries.getQueryData(["me", "status"]), Date.now());
  const wanted = settings.lobby && !quiet && !windowInFront() ? waiting : [];
  const cards = lobbyCards(wanted, meeting, {
    waiting: t("notices.lobby.waiting"),
    many: (count) => t("notices.lobby.many", { count }),
    guest: t("notices.lobby.guest"),
    admit: t("notices.lobby.admit"),
    viewLobby: t("notices.lobby.view"),
    close: t("notices.close"),
  });
  const key = JSON.stringify(cards);
  useEffect(() => {
    const now = new Map(cards.map((card) => [card.id, JSON.stringify(card)]));
    for (const id of sent.current.keys()) if (!now.has(id)) bridge()?.notices?.remove(id);
    for (const card of cards) if (sent.current.get(card.id) !== now.get(card.id)) bridge()?.notices?.show(card);
    sent.current = now;
    // `key` stands for the cards: they are rebuilt each time the page draws.
  }, [key]);
  useEffect(() => () => [...sent.current.keys()].forEach((id) => bridge()?.notices?.remove(id)), []);
  useEffect(
    () =>
      bridge()?.callWindows?.onAction((action) => {
        const chosen = action as { name?: string; cardId?: string; choice?: string };
        if (chosen.name !== "noticeChosen" || !chosen.cardId?.startsWith("lobby:")) return;
        if (chosen.choice === "viewLobby") actions.current.viewLobby();
        else if (chosen.choice === "admit" && chosen.cardId !== MANY_ID) actions.current.admit(chosen.cardId.slice(6));
      }),
    [],
  );
}
