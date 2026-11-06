// Lobby cards (TC-F04-60, 61; AC-F04-34): one per person (a guest marked), one card from three people.
import { describe, expect, it } from "vitest";
import { MANY_ID, lobbyCards, type LobbyWords } from "./lobby-cards.ts";

const WORDS: LobbyWords = {
  waiting: "is waiting in the lobby",
  many: (count) => `${String(count)} people are waiting`,
  guest: "Guest",
  admit: "Admit",
  viewLobby: "View lobby",
  close: "Close",
};
const person = (id: string, group: "member" | "guest" = "member") => ({
  attendanceId: id,
  name: `Person ${id}`,
  group,
});

describe("lobby cards", () => {
  it("TC-F04-60 [AC-F04-34] one person: name, Admit and View lobby; a guest is marked", () => {
    expect(lobbyCards([person("a", "guest")], "Design review", WORDS)).toEqual([
      {
        id: "lobby:a",
        kind: "lobby",
        title: "Person a",
        tag: "Guest",
        text: "is waiting in the lobby",
        detail: "Design review",
        person: { name: "Person a", initials: "" },
        admit: "Admit",
        viewLobby: "View lobby",
        close: "Close",
      },
    ]);
    // Those who can't let people in get an empty list from the page: no cards.
    expect(lobbyCards([], "Design review", WORDS)).toEqual([]);
  });

  it("TC-F04-61 [AC-F04-34] two give two cards; three or more give one card with View lobby only; the count follows", () => {
    expect(lobbyCards([person("a"), person("b")], "M", WORDS).map((c) => c.id)).toEqual(["lobby:a", "lobby:b"]);
    const many = lobbyCards([person("a"), person("b"), person("c"), person("d")], "M", WORDS);
    expect(many).toEqual([
      {
        id: MANY_ID,
        kind: "lobby",
        title: "4 people are waiting",
        detail: "M",
        viewLobby: "View lobby",
        close: "Close",
      },
    ]);
    expect(lobbyCards([person("a"), person("b"), person("c")], "M", WORDS)[0]?.title).toBe("3 people are waiting");
  });
});
