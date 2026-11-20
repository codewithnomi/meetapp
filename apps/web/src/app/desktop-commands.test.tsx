// A clicked meeting link during a call (F17 TC-F17-29, 49; AC-F17-11, AC-F04-10): signed in, it opens Join
// a meeting at once, as the call keeps running in the call host; a guest's call lives on its screen, so for
// guests the link still waits there.
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { useDesktopCommands } from "./desktop-commands.ts";

const fake = vi.hoisted(() => ({ arrive: () => undefined as unknown }));

vi.mock("../features/desktop-app/index.ts", () => ({
  useTrayCommands: () => undefined,
  useMeetingLinks: (onArrive: () => unknown) => {
    fake.arrive = onArrive;
  },
}));
vi.mock("../features/status/index.ts", () => ({ useStatusFromTray: () => vi.fn() }));

function at(path: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}

describe("meeting links during a call", () => {
  it("TC-F17-29 [AC-F17-11] signed in, a link during a call or in the lobby opens Join a meeting at once", () => {
    for (const path of ["/meeting/call", "/meeting/lobby", "/call", "/chat"]) {
      const openJoin = vi.fn();
      renderHook(() => useDesktopCommands({ openSettings: vi.fn(), openJoin }), { wrapper: at(path) });
      fake.arrive();
      expect(openJoin).toHaveBeenCalledOnce();
    }
  });

  it("TC-F17-49 [AC-F04-10] a guest in a call keeps the call screen; the link waits", () => {
    const openJoin = vi.fn();
    renderHook(() => useDesktopCommands({ openJoin }), { wrapper: at("/meeting/call") });
    fake.arrive();
    expect(openJoin).not.toHaveBeenCalled();
    renderHook(() => useDesktopCommands({ openJoin }), { wrapper: at("/join-meeting") });
    fake.arrive();
    expect(openJoin).toHaveBeenCalledOnce();
  });
});
