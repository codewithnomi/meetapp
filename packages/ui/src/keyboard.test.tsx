// Keyboard-only use of the atoms (AC-F00-14): TC-F00-32 interactive atoms work with Tab, Enter and
// Space; TC-F00-34 non-interactive atoms are skipped by Tab.
//
// jsdom has no CSS engine, so "the focused element has a visible outline" is checked here through the
// FOCUS_RING classes (focus-visible:outline-2 + focus-visible:outline-focus-ring). The real computed
// outline (non-zero outline-width in the focus-ring color) is checked in a real browser by the T13
// screenshot / axe pipeline (TC-F00-28, TC-F00-35).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, Icon, IconButton, Spinner } from "./atoms/index.ts";
import { FOCUS_RING } from "./lib/cx.ts";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  start: "Start meeting",
  mute: "Mute",
  record: "Record",
  leave: "Leave",
  first: "First",
  second: "Second",
  muted: "Muted",
  connecting: "Connecting",
};

function expectFocusRing(el: Element) {
  expect(el).toHaveClass("focus-visible:outline-2", "focus-visible:outline-focus-ring");
  expect(el).toHaveClass(...FOCUS_RING.split(" "));
}

function renderControls() {
  const spies = { start: vi.fn(), mute: vi.fn(), disabled: vi.fn(), leave: vi.fn() };
  render(
    <>
      <Button onClick={spies.start}>{T.start}</Button>
      <IconButton icon="mic" label={T.mute} onClick={spies.mute} />
      <Button disabled onClick={spies.disabled}>
        {T.record}
      </Button>
      <Button variant="danger" onClick={spies.leave}>
        {T.leave}
      </Button>
    </>,
  );
  return spies;
}

describe("TC-F00-32 [AC-F00-14] interactive atoms work with the keyboard only", () => {
  it("TC-F00-32 [AC-F00-14] Tab moves focus in order and skips the disabled Button", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.tab();
    expect(screen.getByRole("button", { name: "Start meeting" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Mute" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Leave" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Mute" })).toHaveFocus();
  });

  it("TC-F00-32 [AC-F00-14] Enter and Space each fire the focused Button's handler once", async () => {
    const user = userEvent.setup();
    const spies = renderControls();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(spies.start).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(spies.start).toHaveBeenCalledTimes(2);
    expect(spies.mute).not.toHaveBeenCalled();
    expect(spies.leave).not.toHaveBeenCalled();
  });

  it("TC-F00-32 [AC-F00-14] Enter and Space each fire the focused IconButton's handler once", async () => {
    const user = userEvent.setup();
    const spies = renderControls();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Mute" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(spies.mute).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(spies.mute).toHaveBeenCalledTimes(2);
    expect(spies.start).not.toHaveBeenCalled();
  });

  it("TC-F00-32 [AC-F00-14] the disabled Button never fires (Tab past it, Enter/Space, click)", async () => {
    const user = userEvent.setup();
    const spies = renderControls();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Record" }));
    expect(spies.disabled).not.toHaveBeenCalled();
    expect(spies.leave).toHaveBeenCalledTimes(2);
  });

  it("TC-F00-32 [AC-F00-14] each focused element carries the focus-ring outline classes", async () => {
    const user = userEvent.setup();
    renderControls();
    for (const name of ["Start meeting", "Mute", "Leave"]) {
      await user.tab();
      const focused = screen.getByRole("button", { name });
      expect(focused).toHaveFocus();
      expectFocusRing(focused);
    }
  });

  it.todo("TC-F00-32 [AC-F00-14] Input receives focus in order and holds typed text 'abc' (T12)");
  it.todo("TC-F00-32 [AC-F00-14] Toggle receives focus and flips state with Space (T12)");
  it.todo("TC-F00-32 [AC-F00-14] Input and Toggle carry the focus-ring outline classes (T12)");
});

describe("TC-F00-34 [AC-F00-14] non-interactive atoms are not in the Tab order", () => {
  it("TC-F00-34 [AC-F00-14] Tab goes from the first Button straight past Icon and Spinner to the second", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button>{T.first}</Button>
        <Icon name="mic" />
        <Icon name="mic-off" label={T.muted} />
        <Spinner />
        <Spinner label={T.connecting} />
        <Button>{T.second}</Button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it.todo("TC-F00-34 [AC-F00-14] Avatar between two Buttons is skipped by Tab (T12)");
  it.todo("TC-F00-34 [AC-F00-14] Badge between two Buttons is skipped by Tab (T12)");
});
