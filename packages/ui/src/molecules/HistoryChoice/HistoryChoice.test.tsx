// HistoryChoice tests (TC-F14-79, AC-F14-17): three real radio buttons; the days field comes with its option.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryChoice } from "./HistoryChoice.tsx";

const labels = { none: "None", days: "Last few days", all: "All history", daysField: "Days" };

describe("HistoryChoice", () => {
  it("TC-F14-79 [AC-F14-17] all is chosen; picking another reports it; days shows its field", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HistoryChoice legend="What can Hina see?" labels={labels} value={{ from: "all" }} onChange={onChange} />,
    );
    expect(screen.getByRole("group", { name: "What can Hina see?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All history" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Last few days" }));
    expect(onChange).toHaveBeenCalledWith({ from: "days", days: 7 });
    rerender(
      <HistoryChoice
        legend="What can Hina see?"
        labels={labels}
        value={{ from: "days", days: 400 }}
        onChange={onChange}
        daysError="Choose 1 to 365 days"
      />,
    );
    expect(screen.getByRole("spinbutton", { name: "Days" })).toHaveAccessibleDescription("Choose 1 to 365 days");
  });
});
