// PollCreator tests (F03 TC-F03-42): Post waits for a question and two answers, answers can be added up
// to 10 and removed down to 2, and the choices reach the page.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_POLL_LABELS } from "./labels.ts";
import { PollCreator } from "./PollCreator.tsx";

describe("PollCreator", () => {
  it("TC-F03-42 [AC-F03-21] a complete poll is posted with its settings", async () => {
    const onPost = vi.fn();
    render(<PollCreator open onOpenChange={vi.fn()} onPost={onPost} labels={SAMPLE_POLL_LABELS} />);
    const post = screen.getByRole("button", { name: "Post poll" });
    expect(post).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Question"), "Which day?");
    await userEvent.type(screen.getByRole("textbox", { name: "Answer 1" }), "Tuesday");
    await userEvent.type(screen.getByRole("textbox", { name: "Answer 2" }), "Thursday");
    await userEvent.click(screen.getByRole("switch", { name: "Anonymous votes" }));
    await userEvent.click(post);
    expect(onPost).toHaveBeenCalledWith({
      question: "Which day?",
      options: ["Tuesday", "Thursday"],
      multiple: false,
      anonymous: true,
    });
  });

  it("TC-F03-42 [AC-F03-21] answers go up to 10 and down to 2", async () => {
    render(<PollCreator open onOpenChange={vi.fn()} onPost={vi.fn()} labels={SAMPLE_POLL_LABELS} />);
    expect(screen.queryByRole("button", { name: "Remove answer 1" })).toBeNull();
    for (let i = 0; i < 8; i++) await userEvent.click(screen.getByRole("button", { name: "Add an answer" }));
    expect(screen.getAllByRole("textbox", { name: /^Answer/ })).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Add an answer" })).toBeNull();
  });
});
