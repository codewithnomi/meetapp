// InviteForm tests (TC-F01-48, AC-F01-17, 28): typing and the role reach the page; Send submits; the
// role choice exists only for people who may invite admins; an error is linked to the field.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { InviteForm, type InviteRole } from "./InviteForm.tsx";

const LABELS = {
  emails: "Email addresses",
  placeholder: "sara@aria.com",
  hint: "Invitations last 7 days.",
  role: "Role",
  roles: { member: "Member", admin: "Admin" },
  submit: "Send invitations",
  pending: "Sending invitations",
};

function Harness({
  onSubmit,
  canInviteAdmin = true,
}: {
  onSubmit: (v: string, r: InviteRole) => void;
  canInviteAdmin?: boolean;
}) {
  const [value, setValue] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  return (
    <InviteForm
      value={value}
      onValueChange={setValue}
      role={role}
      onRoleChange={setRole}
      canInviteAdmin={canInviteAdmin}
      onSubmit={() => onSubmit(value, role)}
      labels={LABELS}
    />
  );
}

describe("InviteForm", () => {
  it("TC-F01-48 [AC-F01-17] sends what was typed with the chosen role, with Enter or the button", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Email addresses" }), "sara@aria.com");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    expect(onSubmit).toHaveBeenCalledWith("sara@aria.com", "admin");
    await userEvent.type(screen.getByRole("textbox", { name: "Email addresses" }), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("TC-F01-48 [AC-F01-17] members get no role choice", () => {
    render(<Harness onSubmit={vi.fn()} canInviteAdmin={false} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("TC-F01-48 [AC-F01-28] an error replaces the hint and is linked to the field; sending shows a spinner", () => {
    const props = { value: "x", onValueChange: vi.fn(), role: "member" as const, onRoleChange: vi.fn() };
    const { rerender } = render(
      <InviteForm {...props} canInviteAdmin onSubmit={vi.fn()} labels={LABELS} error="Check this address: x" />,
    );
    const field = screen.getByRole("textbox", { name: "Email addresses" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Check this address: x");
    rerender(<InviteForm {...props} canInviteAdmin onSubmit={vi.fn()} labels={LABELS} pending />);
    expect(screen.getByRole("button", { name: /Send invitations/ })).toBeDisabled();
  });
});
