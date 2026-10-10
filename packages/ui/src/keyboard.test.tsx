// Keyboard-only use of the atoms (AC-F00-14): TC-F00-32 interactive atoms work with Tab, Enter and
// Space; TC-F00-34 non-interactive atoms are skipped by Tab.
//
// jsdom has no CSS engine, so "the focused element has a visible outline" is checked here through the
// FOCUS_RING classes (focus-visible:outline-2 + focus-visible:outline-focus-ring). The real computed
// outline (non-zero outline-width in the focus-ring color) is checked in a real browser by the T13
// screenshot / axe pipeline (TC-F00-28, TC-F00-35).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Avatar, Badge, Button, Icon, IconButton, Input, Spinner, Toggle } from "./atoms/index.ts";
import { FOCUS_RING } from "./lib/cx.ts";
import { AccentPicker, SegmentedControl } from "./molecules/index.ts";

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
  name: "Display name",
  captions: "Live captions",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  accent: "Accent color",
  aisha: "Aisha Khan",
  live: "Live",
  accents: {
    sky: "Sky",
    blue: "Blue",
    purple: "Purple",
    pink: "Pink",
    red: "Red",
    orange: "Orange",
    green: "Green",
    teal: "Teal",
  },
};

function expectFocusRing(el: Element) {
  expect(el).toHaveClass("focus-visible:outline-2", "focus-visible:outline-focus-ring");
  expect(el).toHaveClass(...FOCUS_RING.split(" "));
}

/** Toggle is controlled; this keeps its state like a real screen would. */
function ControlledToggle({ onChange }: { onChange: (next: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Toggle
      id="captions"
      label={T.captions}
      checked={checked}
      onChange={(next) => {
        onChange(next);
        setChecked(next);
      }}
    />
  );
}

function renderFormControls() {
  const spies = { input: vi.fn(), toggle: vi.fn() };
  render(
    <>
      <Button>{T.start}</Button>
      <Input id="name" label={T.name} onChange={spies.input} />
      <ControlledToggle onChange={spies.toggle} />
      <SegmentedControl
        label={T.theme}
        options={[
          { value: "light", label: T.light },
          { value: "dark", label: T.dark },
        ]}
        value="dark"
        onChange={() => {}}
      />
      <AccentPicker label={T.accent} labels={T.accents} value="green" onChange={() => {}} />
      <Button variant="danger">{T.leave}</Button>
    </>,
  );
  return spies;
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

  it("TC-F00-32 [AC-F00-14] Tab order: Button, Input, Toggle, SegmentedControl and AccentPicker (one stop each), Button", async () => {
    const user = userEvent.setup();
    renderFormControls();
    const order = [
      screen.getByRole("button", { name: "Start meeting" }),
      screen.getByRole("textbox", { name: "Display name" }),
      screen.getByRole("switch", { name: "Live captions" }),
      screen.getByRole("radio", { name: "Dark" }),
      screen.getByRole("radio", { name: "Green" }),
      screen.getByRole("button", { name: "Leave" }),
    ];
    for (const el of order) {
      await user.tab();
      expect(el).toHaveFocus();
    }
    for (const el of order.slice(0, -1).reverse()) {
      await user.tab({ shift: true });
      expect(el).toHaveFocus();
    }
  });

  it("TC-F00-32 [AC-F00-14] Input receives focus in order and holds typed text 'abc'", async () => {
    const user = userEvent.setup();
    const spies = renderFormControls();
    await user.tab();
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveFocus();
    await user.keyboard("abc");
    expect(input).toHaveValue("abc");
    expect(spies.input).toHaveBeenCalledTimes(3);
  });

  it("TC-F00-32 [AC-F00-14] Toggle receives focus and flips state with Space and with Enter", async () => {
    const user = userEvent.setup();
    const spies = renderFormControls();
    await user.tab();
    await user.tab();
    await user.tab();
    const toggle = screen.getByRole("switch", { name: "Live captions" });
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(spies.toggle.mock.calls).toEqual([[true], [false]]);
  });

  it("TC-F00-32 [AC-F00-14] Input and Toggle carry the focus-ring outline classes", () => {
    renderFormControls();
    // Input uses a 1px offset (design system), so only width and color are shared with FOCUS_RING.
    expect(screen.getByRole("textbox")).toHaveClass("focus-visible:outline-2", "focus-visible:outline-focus-ring");
    expectFocusRing(screen.getByRole("switch"));
    for (const radio of screen.getAllByRole("radio")) expectFocusRing(radio);
  });
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

  it("TC-F00-34 [AC-F00-14] Tab goes from the first Button straight past Avatar and Badge to the second", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button>{T.first}</Button>
        <Avatar name={T.aisha} />
        <Avatar name={T.aisha} src="https://example.test/a.png" size="lg" />
        <Badge>{T.live}</Badge>
        <Badge tone="danger" icon="signal">
          {T.live}
        </Badge>
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
});
