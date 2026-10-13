// Notice molecule tests: errors are announced at once, information quietly; the action is a real button.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Notice } from "./Notice.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
describe("Notice", () => {
  it("TC-F01-14 [AC-F01-05] an error is an alert; information is a status", () => {
    render(
      <>
        <Notice tone="danger">Email or password is wrong.</Notice>
        <Notice tone="neutral">You'll stay signed in here.</Notice>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Email or password is wrong.");
    expect(screen.getByRole("status")).toHaveTextContent("You'll stay signed in here.");
  });

  it("TC-F01-73 [AC-F01-29] the action (Retry) works with the keyboard", async () => {
    const onClick = vi.fn();
    render(
      <Notice tone="danger" action={{ label: "Retry", onClick }}>
        Can't reach MeetApp.
      </Notice>,
    );
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("TC-F01-53 [AC-F01-19] success is a quiet status with a check and a bold title", () => {
    render(
      <Notice tone="success" title="Request sent">
        We'll tell you when it is approved.
      </Notice>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Request sent");
    expect(status).toHaveTextContent("We'll tell you when it is approved.");
    expect(status.querySelector("svg")).not.toBeNull();
  });
});
