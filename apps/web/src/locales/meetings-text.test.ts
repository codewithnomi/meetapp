// TC-F02-90 (AC-F02-45), the "source is scanned for text" part: the new meeting screens hold no
// hard-coded words. Text between tags, and text props such as label="…" or title="…", must come from
// t("…"). (Missing keys are caught by en.test.ts for the whole app.) Since F14 also the Chat screen
// (TC-F14-62, AC-F14-30).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const FOLDERS = [
  "pages/MeetingsPage",
  "pages/JoinMeetingPage",
  "pages/PreJoinPage",
  "pages/LobbyPage",
  "pages/MeetingEndedPage",
  "pages/MeetingPage",
  "pages/WorkspaceSettingsPage",
  "features/meetings",
  "pages/ChatsPage",
  "features/chats",
];

function screens(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screens(path);
    return /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

// "=>" is an arrow function, not the end of a tag.
const BETWEEN_TAGS = /(?<!=)>\s*([A-Za-z][A-Za-z ,.'!?-]*[A-Za-z.!?])\s*</g;
const TEXT_PROPS = /\b(?:label|title|placeholder|aria-label|description|hint|alt)="([^"{}]*[A-Za-z][^"{}]*)"/g;

describe("TC-F02-90 no hard-coded text in the meeting screens", () => {
  it("TC-F02-90 TC-F14-62 [AC-F02-45] [AC-F14-30] every word on screen comes from the translation file", () => {
    const files = FOLDERS.flatMap(screens);
    expect(files.length).toBeGreaterThan(10);
    const found = files.flatMap((file) => {
      const code = readFileSync(join(SRC, file), "utf8");
      // Generic type arguments (Array<string>) and comparisons are not text; JSX text follows a tag's ">".
      const words = [...code.matchAll(BETWEEN_TAGS), ...code.matchAll(TEXT_PROPS)].map((m) => m[1] ?? "");
      return words.map((word) => `${relative(SRC, join(SRC, file))}: ${word}`);
    });
    expect(found).toEqual([]);
  });
});
