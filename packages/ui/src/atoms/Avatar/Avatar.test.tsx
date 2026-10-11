// Avatar atom tests: named image with initials or a photo, sizes, the "speaking" ring with its own
// announcement, never focusable (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./Avatar.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  aisha: "aisha khan",
  ravi: "Ravi",
  mary: "Mary Ann Lee",
  speaking: "aisha khan, speaking",
  photo: "https://example.test/aisha.png",
};

type AvatarSize = "sm" | "md" | "lg" | "xl";
const SIZES: [AvatarSize, string][] = [
  ["sm", "size-7"],
  ["md", "size-9"],
  ["lg", "size-12"],
  ["xl", "size-22"],
];
const SPEAKING = ["ring-speaking", "ring-3", "ring-offset-2", "ring-offset-bg"];

describe("Avatar", () => {
  it("TC-F00-27 [AC-F00-13] is an image named by the person, md size and accent-soft colors by default", () => {
    render(<Avatar name={T.aisha} />);
    const avatar = screen.getByRole("img", { name: "aisha khan" });
    expect(avatar.tagName.toLowerCase()).toBe("span");
    expect(avatar).toHaveClass("size-9", "bg-accent-soft", "text-accent-text", "rounded-full");
  });

  it.each([
    [T.aisha, "AK"],
    [T.ravi, "R"],
    [T.mary, "MA"],
  ])("TC-F00-27 [AC-F00-13] %s shows initials %s, hidden from screen readers", (name, initials) => {
    render(<Avatar name={name} />);
    const avatar = screen.getByRole("img", { name });
    const text = Array.from(avatar.querySelectorAll("[aria-hidden='true']")).find((el) => el.textContent === initials);
    expect(text).toBeDefined();
    expect(avatar).toHaveTextContent(initials);
  });

  it("TC-F00-27 [AC-F00-13] with src shows a decorative photo instead of initials", () => {
    render(<Avatar name={T.aisha} src={T.photo} />);
    const avatar = screen.getByRole("img", { name: "aisha khan" });
    const photo = avatar.querySelector("img");
    expect(photo).not.toBeNull();
    expect(photo).toHaveAttribute("src", T.photo);
    expect(photo).toHaveAttribute("alt", "");
    expect(avatar).not.toHaveTextContent("AK");
  });

  it.each(SIZES)("TC-F00-27 [AC-F00-13] size %s uses %s", (size, cls) => {
    render(<Avatar name={T.ravi} size={size} />);
    const avatar = screen.getByRole("img");
    expect(avatar).toHaveClass(cls);
    for (const [, other] of SIZES.filter(([s]) => s !== size)) expect(avatar).not.toHaveClass(other);
  });

  it("TC-F00-27 [AC-F00-13] speaking shows the speaking ring and is announced with speakingLabel", () => {
    render(<Avatar name={T.aisha} speaking speakingLabel={T.speaking} />);
    const avatar = screen.getByRole("img", { name: "aisha khan, speaking" });
    expect(avatar).toHaveClass(...SPEAKING);
  });

  it("TC-F00-27 [AC-F00-13] not speaking: no speaking ring", () => {
    render(<Avatar name={T.aisha} />);
    const avatar = screen.getByRole("img");
    for (const cls of SPEAKING) expect(avatar).not.toHaveClass(cls);
  });

  it("TC-F00-27 [AC-F00-13] speaking requires speakingLabel; a JavaScript caller without it falls back to the name", () => {
    // @ts-expect-error speakingLabel is required while speaking (screen readers must hear who is talking)
    render(<Avatar name={T.aisha} speaking />);
    expect(screen.getByRole("img", { name: "aisha khan" })).toHaveClass("ring-speaking");
  });

  it("TC-F00-34 [AC-F00-14] is not focusable", () => {
    render(<Avatar name={T.aisha} src={T.photo} />);
    const avatar = screen.getByRole("img");
    expect(avatar).not.toHaveAttribute("tabindex");
    avatar.focus();
    expect(avatar).not.toHaveFocus();
  });

  it("TC-F00-27 [AC-F00-13] className is added", () => {
    render(<Avatar name={T.ravi} className="shrink-0" />);
    expect(screen.getByRole("img")).toHaveClass("shrink-0", "rounded-full");
  });
});
