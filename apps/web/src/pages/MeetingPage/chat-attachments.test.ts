// Quick checks before uploading (F03 TC-F03-52, 61 app part): too big and unknown kinds are refused
// at once with the right message; the server checks every file again by its content.
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, quickCheck } from "./chat-attachments.ts";

const file = (name: string, size = 10) => ({ name, size }) as File;

describe("quickCheck", () => {
  it("TC-F03-61 [AC-F03-12] [AC-F03-13] allowed kinds up to 25 MB pass; bigger or other kinds are refused", () => {
    for (const name of ["a.png", "b.JPG", "c.pdf", "d.csv", "e.docx", "f.pptx"])
      expect(quickCheck(file(name))).toBeUndefined();
    expect(quickCheck(file("big.pdf", MAX_FILE_BYTES + 1))).toBe("CHAT_FILE_TOO_BIG");
    for (const name of ["setup.exe", "old.doc", "macro.docm", "notes.md"])
      expect(quickCheck(file(name))).toBe("CHAT_FILE_TYPE");
  });
});
