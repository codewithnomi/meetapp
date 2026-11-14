// TC-F17-44 [AC-F17-18]: after a screen change focus goes to the new screen's title, never into the call
// hidden behind it, even when the hidden call comes first on the page.
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { useFocusOnScreenChange } from "./focus.ts";

let go: (path: string) => void = () => undefined;

function Screens() {
  const navigate = useNavigate();
  useEffect(() => {
    go = (path) => void navigate(path);
  }, [navigate]);
  useFocusOnScreenChange();
  return (
    <>
      <div data-call-host="" hidden>
        <main>
          <h1 tabIndex={-1}>The call</h1>
        </main>
      </div>
      <Routes>
        <Route
          path="/meetings"
          element={
            <main>
              <h1 tabIndex={-1}>Meetings</h1>
            </main>
          }
        />
        <Route
          path="/chat"
          element={
            <main>
              <h1 tabIndex={-1}>Chat</h1>
            </main>
          }
        />
      </Routes>
    </>
  );
}

describe("focus on screen change", () => {
  it("TC-F17-44 [AC-F17-18] lands on the new screen's title, never in the hidden call", () => {
    render(
      <MemoryRouter initialEntries={["/meetings"]}>
        <Screens />
      </MemoryRouter>,
    );
    act(() => go("/chat"));
    expect(screen.getByRole("heading", { name: "Chat" })).toHaveFocus();
  });
});
