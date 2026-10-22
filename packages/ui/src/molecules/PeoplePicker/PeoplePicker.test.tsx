// PeoplePicker tests (TC-F14-79, AC-F14-07, 08): a combobox with suggestions, keyboard picking, chips that
// can be removed, and the "no account" note with Invite.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PeoplePicker, type PeoplePickerProps } from "./PeoplePicker.tsx";

const props = (overrides: Partial<PeoplePickerProps> = {}): PeoplePickerProps => ({
  label: "To:",
  picked: [{ id: "s", name: "Sara Malik", removeLabel: "Remove Sara Malik" }],
  query: "bil",
  onQueryChange: vi.fn(),
  suggestions: [
    { id: "b", name: "Bilal Ahmed" },
    { id: "h", name: "Bilal Hussain", externalLabel: "(External)" },
  ],
  suggestionsLabel: "Suggestions",
  onPick: vi.fn(),
  onRemove: vi.fn(),
  ...overrides,
});

describe("PeoplePicker", () => {
  it("TC-F14-79 [AC-F14-07] arrows move through the suggestions; Enter picks", async () => {
    const p = props();
    render(<PeoplePicker {...p} />);
    const box = screen.getByRole("combobox", { name: "To:" });
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Suggestions" })).toBeVisible();
    await userEvent.click(box);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(p.onPick).toHaveBeenCalledWith("h");
    expect(screen.getByRole("option", { name: /Bilal Hussain/ })).toHaveTextContent("(External)");
  });

  it("TC-F14-79 [AC-F14-07] chips can be removed by button, or with Backspace in an empty field", async () => {
    const p = props({ query: "", suggestions: [] });
    render(<PeoplePicker {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Sara Malik" }));
    expect(p.onRemove).toHaveBeenCalledWith("s");
    await userEvent.click(screen.getByRole("combobox", { name: "To:" }));
    await userEvent.keyboard("{Backspace}");
    expect(p.onRemove).toHaveBeenCalledTimes(2);
  });

  it("TC-F14-79 [AC-F14-08] an email without an account offers Invite", async () => {
    const onInvite = vi.fn();
    render(
      <PeoplePicker
        {...props({
          suggestions: [],
          noAccount: { email: "sam@contoso.com", message: "No one uses this yet.", inviteLabel: "Invite", onInvite },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(onInvite).toHaveBeenCalledOnce();
  });
});
