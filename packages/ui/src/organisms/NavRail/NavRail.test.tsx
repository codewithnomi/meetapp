// NavRail tests (TC-F14-81, AC-F14-36): the fold button folds and unfolds with aria-expanded following;
// folded, items keep their names (shown in tooltips) and Chat's count stays on its icon, 99+ above 99.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NavRail, type NavItem } from "./NavRail.tsx";

const items: NavItem[] = [
  { id: "home", label: "Home", icon: "home", current: false, onSelect: vi.fn() },
  { id: "chat", label: "Chat", icon: "chat", current: true, onSelect: vi.fn(), badge: 140 },
];

function Folding() {
  const [folded, setFolded] = useState(false);
  return (
    <NavRail
      label="Main"
      switcher={<span>Aria workspace</span>}
      items={items}
      fold={{
        folded,
        onToggle: () => setFolded(!folded),
        foldLabel: "Collapse menu",
        unfoldLabel: "Expand menu",
        foldedSwitcher: <span>A</span>,
      }}
    />
  );
}

describe("NavRail", () => {
  it("TC-F14-81 [AC-F14-36] the button folds to icons and back; aria-expanded follows", async () => {
    render(<Folding />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(screen.getByRole("button", { name: "Collapse menu" })).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveTextContent("Aria workspace");
    await userEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
    expect(nav).toHaveAttribute("data-folded", "true");
    expect(screen.getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveTextContent("Aria workspace");
    await userEvent.click(screen.getByRole("button", { name: "Expand menu" }));
    expect(nav).toHaveAttribute("data-folded", "false");
  });

  it("TC-F14-81 [AC-F14-36] folded, items keep their names, a tooltip on focus, and Chat's 99+ on the icon", async () => {
    render(<Folding />);
    await userEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
    const chat = screen.getByRole("button", { name: "Chat 99+" });
    expect(chat).toHaveAttribute("aria-current", "page");
    expect(chat).toHaveTextContent("99+");
    // Focus is still on the fold button: the next item is Home.
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Home");
  });

  it("TC-F14-81 [AC-F14-36] a menu without folding has no fold button", () => {
    render(<NavRail label="Settings" switcher={null} items={items} />);
    expect(screen.queryByRole("button", { name: /menu/ })).not.toBeInTheDocument();
  });

  it("TC-F14-81 [AC-F14-36] a translated name with the count is used when given", () => {
    const named: NavItem[] = [
      {
        id: "chat",
        label: "Chat",
        icon: "chat",
        current: true,
        onSelect: vi.fn(),
        badge: 3,
        badgeLabel: "Chat, 3 unread chats",
      },
    ];
    render(<NavRail label="Main" switcher={<span>Aria workspace</span>} items={named} />);
    expect(screen.getByRole("button", { name: "Chat, 3 unread chats" })).toBeInTheDocument();
  });
});
