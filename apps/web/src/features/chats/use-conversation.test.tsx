// The open chat's live parts (F14 AC-F14-20, 22–24, 26): typing names from the line (others only, gone
// when they send), the typing signal at most every 3 s, "Seen" refreshed by read news, the polling
// switch, and activity and the locked computer sent on the line. A stand-in replaces the WebSocket.
import type { ChatMessageView } from "@meetapp/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveLineProvider, usePolling } from "./LiveLineProvider.tsx";
import { useSeen, useTyping } from "./use-conversation.ts";

const apiRequest = vi.fn<(path: string) => Promise<unknown>>();
vi.mock("../api/index.ts", () => ({
  apiRequest: (path: string) => apiRequest(path),
  apiFileUrl: (path: string) => `http://api.test${path}`,
}));

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
}

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const U2 = "33333333-3333-4333-8333-333333333333";
const U3 = "44444444-4444-4444-8444-444444444444";
const ME = "55555555-5555-4555-8555-555555555555";

const socket = () => FakeSocket.all.at(-1) as FakeSocket;
const open = () =>
  act(() => {
    socket().readyState = 1;
    socket().onopen?.();
  });
const hear = (message: object) => act(() => socket().onmessage?.({ data: JSON.stringify(message) }));

function wrapper(queries = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <LiveLineProvider>{children}</LiveLineProvider>
    </QueryClientProvider>
  );
}

const message = (id: string, userId: string, kind = "text") =>
  ({ id, kind, sender: { userId, name: userId } }) as unknown as ChatMessageView;

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  apiRequest.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("typing", () => {
  it("TC-F14-47 [AC-F14-23] others' typing shows; one's own and other chats' don't; a message ends it", () => {
    const { result } = renderHook(() => useTyping(C1, ME), { wrapper: wrapper() });
    open();
    hear({ t: "typing", conversationId: C1, userId: U2, name: "Sara" });
    hear({ t: "typing", conversationId: C1, userId: ME, name: "Me" });
    hear({ t: "typing", conversationId: C2, userId: U3, name: "Omar" });
    expect(result.current.names).toEqual(["Sara"]);
    const sent = {
      id: "66666666-6666-4666-8666-666666666666",
      cursor: "c1",
      clientId: "client-1",
      callId: null,
      kind: "text",
      sender: { attendanceId: null, name: "Sara", group: "member", userId: U2 },
      body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      replyTo: null,
      reactions: [],
      attachments: [],
      gif: null,
      sticker: null,
      pollId: null,
      system: null,
    };
    hear({ t: "news", conversationId: C1, event: { seq: 2, type: "message_created", id: sent.id, message: sent } });
    expect(result.current.names).toEqual([]);
  });

  it("TC-F14-47 [AC-F14-23] the signal goes at most once every 3 seconds", () => {
    const { result } = renderHook(() => useTyping(C1, ME), { wrapper: wrapper() });
    open();
    act(() => {
      result.current.onTyping();
      result.current.onTyping();
    });
    expect(socket().sent).toEqual([{ t: "typing", conversationId: C1 }]);
  });
});

describe("Seen", () => {
  it("TC-F14-49 [AC-F14-24] asks who saw my newest message, again on read news; nobody yet shows nothing", async () => {
    apiRequest.mockResolvedValueOnce({ people: [] }).mockResolvedValue({ people: [{ userId: U2, name: "Sara" }] });
    const messages = [message("a", ME), message("b", U2), message("n", ME, "system")];
    const { result } = renderHook(() => useSeen(C1, messages, ME), { wrapper: wrapper() });
    open();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/v1/conversations/${C1}/messages/a/seen`));
    expect(result.current.own?.id).toBe("a");
    expect(result.current.people).toBeNull();
    hear({ t: "read", conversationId: C1, userId: U2, seq: 3 });
    await waitFor(() => expect(result.current.people).toEqual([{ userId: U2, name: "Sara" }]));
  });

  it("TC-F14-49 [AC-F14-24] without a message of my own nothing is asked", () => {
    const { result } = renderHook(() => useSeen(C1, [message("b", U2)], ME), { wrapper: wrapper() });
    expect(result.current.own).toBeUndefined();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

describe("the line's provider", () => {
  it("TC-F14-44 [AC-F14-20] polling turns on when the server says so and off on a fresh line", () => {
    const { result } = renderHook(() => usePolling(), { wrapper: wrapper() });
    open();
    hear({ t: "polling", on: true });
    expect(result.current).toBe(true);
    open();
    expect(result.current).toBe(false);
  });

  it("TC-F14-03 [AC-F14-02] list news reloads the chat list", () => {
    const queries = new QueryClient();
    const reload = vi.spyOn(queries, "invalidateQueries");
    renderHook(() => usePolling(), { wrapper: wrapper(queries) });
    open();
    reload.mockClear();
    hear({ t: "list", conversationId: C1, change: "changed" });
    expect(reload).toHaveBeenCalledWith({ queryKey: ["chats"] });
  });

  it("TC-F14-52 [AC-F14-26] a key press sends activity at most once a minute; locking sends Away", () => {
    let lock: ((locked: boolean) => void) | undefined;
    vi.stubGlobal("meetapp", {
      power: {
        onLockChange: (listener: (locked: boolean) => void) => {
          lock = listener;
          return () => undefined;
        },
      },
    });
    renderHook(() => usePolling(), { wrapper: wrapper() });
    open();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    act(() => lock?.(true));
    expect(socket().sent).toEqual([
      { t: "active", active: true },
      { t: "active", active: false },
    ]);
  });
});
