// StatusDot tests (TC-F14-79, AC-F14-26): each status has its word for screen readers and its own look.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusDot, type ChatStatus } from "./StatusDot.tsx";

describe("StatusDot", () => {
  it.each<[ChatStatus, string]>([
    ["available", "Available"],
    ["away", "Away"],
    ["in_call", "In a call"],
    ["offline", "Offline"],
  ])("TC-F14-79 [AC-F14-26] %s is named %s", (status, label) => {
    render(<StatusDot status={status} label={label} />);
    expect(screen.getByRole("img", { name: label })).toHaveAttribute("data-status", status);
  });
});
