// PollCard tests (F03 TC-F03-42): choosing votes at once, several answers toggle, results show only
// when given, and a closed poll can't be voted in.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PollCard, type PollCardProps } from "./PollCard.tsx";

const BASE: PollCardProps = {
  question: "Which day?",
  about: "Poll by Aisha Khan · One answer",
  options: [
    { id: "a", text: "Tuesday" },
    { id: "b", text: "Wednesday" },
  ],
  multiple: false,
  chosen: [],
  hint: "Vote to see the results",
  onVote: vi.fn(),
};

describe("PollCard", () => {
  it("TC-F03-42 [AC-F03-22] one answer: choosing votes at once; no results before voting", async () => {
    const onVote = vi.fn();
    render(<PollCard {...BASE} onVote={onVote} />);
    expect(screen.queryByText(/%/)).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Wednesday" }));
    expect(onVote).toHaveBeenCalledWith(["b"]);
  });

  it("TC-F03-42 [AC-F03-22] several answers add to the choice; results show with percentages", async () => {
    const onVote = vi.fn();
    render(
      <PollCard
        {...BASE}
        multiple
        chosen={["a"]}
        onVote={onVote}
        results={{
          summary: "2 people voted",
          options: [
            { id: "a", percent: 100, label: "100% · 2", names: [] },
            { id: "b", percent: 50, label: "50% · 1", names: [] },
          ],
        }}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /Wednesday/ }));
    expect(onVote).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.getByText("2 people voted")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Tuesday/ })).toHaveTextContent("100% · 2");
  });

  it("TC-F03-42 [AC-F03-23] a closed poll can't be voted in", () => {
    render(<PollCard {...BASE} closedLabel="Closed" />);
    expect(screen.getByRole("radio", { name: "Tuesday" })).toBeDisabled();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
});
