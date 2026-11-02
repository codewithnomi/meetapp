// Unit tests for the chat rules on the computer (F03 TC-F03-33, 34; design.md 5.1 and 6).
import { describe, expect, it } from "vitest";
import { dictionaryUrl, isChatFileUrl, spellcheckMenu } from "./chat-desktop.ts";
import { contentSecurityPolicy } from "./security.ts";

const API = "http://127.0.0.1:3000";
const TOKEN = "0b0f5f3e-5d6a-4a4c-9e8b-111111111111.f.1792000000000.abcDEF_-123";

describe("chat file downloads", () => {
  it("TC-F03-56 [AC-F03-31] only our backend's chat file links may be saved", () => {
    expect(isChatFileUrl(`${API}/api/v1/chat-files/${TOKEN}`, API)).toBe(true);
    expect(isChatFileUrl(`https://evil.example/api/v1/chat-files/${TOKEN}`, API)).toBe(false);
    expect(isChatFileUrl(`${API}/api/v1/me`, API)).toBe(false);
    expect(isChatFileUrl(`${API}/api/v1/chat-files/../me`, API)).toBe(false);
    expect(isChatFileUrl("file:///etc/passwd", API)).toBe(false);
    expect(isChatFileUrl("not a url", API)).toBe(false);
  });
});

describe("TC-F03-33 spell-check menu", () => {
  const params = {
    misspelledWord: "recieve",
    dictionarySuggestions: ["receive", "relieve"],
    isEditable: true,
    editFlags: { canCut: true, canCopy: true, canPaste: true },
  };

  it("TC-F03-33 [AC-F03-18] corrections, Add to dictionary, then Cut, Copy and Paste", () => {
    expect(spellcheckMenu(params).map((entry) => ("label" in entry ? entry.label : "—"))).toEqual([
      "receive",
      "relieve",
      "Add to dictionary",
      "—",
      "Cut",
      "Copy",
      "Paste",
    ]);
  });

  it("TC-F03-33 [AC-F03-18] a correctly spelled word gets only the editing commands", () => {
    const entries = spellcheckMenu({ ...params, misspelledWord: "", dictionarySuggestions: [] });
    expect(entries.map((entry) => entry.kind)).toEqual(["edit", "edit", "edit"]);
  });

  it("TC-F03-33 [AC-F03-18] outside a text box there is nothing to offer", () => {
    expect(spellcheckMenu({ ...params, misspelledWord: "", dictionarySuggestions: [], isEditable: false })).toEqual([]);
  });

  it("TC-F03-34 [AC-F03-18] dictionaries come from the app itself, never from an outside server", () => {
    expect(dictionaryUrl("app://meetapp")).toBe("app://meetapp/dictionaries/");
  });
});

describe("TC-F03-93 content security policy for GIFs", () => {
  it("TC-F03-93 [AC-F03-24] KLIPY's API may be called and its pictures shown; no other outside host", () => {
    const csp = contentSecurityPolicy({ apiUrl: API, gifApiUrl: "https://api.klipy.com" });
    const part = (name: string) => csp.split("; ").find((entry) => entry.startsWith(name)) ?? "";
    expect(part("connect-src")).toBe(
      "connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000 https://api.klipy.com",
    );
    expect(part("img-src")).toBe("img-src 'self' data: http://127.0.0.1:3000 https://static.klipy.com");
  });
});
