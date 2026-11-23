// TC-F13-42 (AC-F13-25): the calendar's screens take every text from the translation file: each key they
// use exists in en.json (the app-wide check, TC-F00-38, reads them too), and no fixed English words sit
// in their markup or in the words they hand to components.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..", "..");
const PLACES = ["features/scheduling", "pages/CalendarPage", "pages/SchedulePage"];
const FILES = ["pages/MeetingsPage/UpcomingMeetings.tsx"];

function files(): string[] {
  const inPlaces = PLACES.flatMap((place) =>
    readdirSync(join(SRC, place))
      .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name))
      .map((name) => join(SRC, place, name)),
  );
  return [...inPlaces, ...FILES.map((file) => join(SRC, file))];
}

/** Words between tags (`>Send<`) and words in text props (`label="Send"`). */
const JSX_TEXT = />[ \t]*([A-Za-z][^<>{}\n;=()]*[A-Za-z])[ \t]*</g;
const TEXT_PROP = /\b(label|aria-label|title|placeholder|alt)=["']([A-Za-z][^"']*)["']/g;

function fixedText(file: string): string[] {
  const code = readFileSync(file, "utf8")
    // Comments may say anything.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...code.matchAll(JSX_TEXT), ...code.matchAll(TEXT_PROP)].map((m) => m[0]);
}

describe("the calendar's texts", () => {
  it("TC-F13-42 [AC-F13-25] the check reads the new screens (it is not empty)", () => {
    expect(files().length).toBeGreaterThan(10);
  });

  it("TC-F13-42 [AC-F13-25] the check spots fixed English", () => {
    const found = [...`<p>Hello there</p> <Button label="Send" />`.matchAll(JSX_TEXT)].length;
    expect(found).toBe(1);
    expect([...`<Button label="Send" />`.matchAll(TEXT_PROP)]).toHaveLength(1);
  });

  it("TC-F13-42 [AC-F13-25] no fixed English text remains in the calendar, the form or Upcoming", () => {
    const found = files().flatMap((file) => fixedText(file).map((text) => `${relative(SRC, file)}: ${text}`));
    expect(found).toEqual([]);
  });
});
