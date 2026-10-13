// AuthLayout template tests: the form is the screen's main area, the tiles are hidden from screen
// readers, and the steps say which one is current and which are done.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthLayout, AuthSteps, AuthTiles } from "./AuthLayout.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
describe("AuthLayout", () => {
  it("TC-F01-14 [AC-F01-28] the form is in the main area; the wordmark and stage are beside it", () => {
    render(
      <AuthLayout brand="MeetApp" aside={<AuthTiles headline="Meetings that remember." description="Calls." />}>
        <h1>Sign in</h1>
      </AuthLayout>,
    );
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("MeetApp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Meetings that remember." })).toBeInTheDocument();
  });

  it("TC-F01-14 [AC-F01-28] steps: the current one is marked for screen readers; done ones show a tick", () => {
    render(
      <AuthSteps
        steps={[
          { title: "Email entered", state: "done" },
          { title: "New password", state: "current" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[0]?.querySelector("svg")).not.toBeNull();
  });
});
