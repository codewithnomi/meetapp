// Tests TC-F00-58, TC-F00-59 (AC-F00-24): app:// files are served only from inside the screens' folder.
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contentType, fileForAddress } from "./serve-files.ts";

const ROOT = resolve("/srv/dist");

describe("fileForAddress", () => {
  it("TC-F00-58 [AC-F00-24] maps / to index.html", () => {
    expect(fileForAddress(ROOT, "app://meetapp/")).toBe(resolve(ROOT, "index.html"));
  });

  it("TC-F00-58 [AC-F00-24] maps nested asset paths inside the folder", () => {
    expect(fileForAddress(ROOT, "app://meetapp/assets/a/b.js")).toBe(resolve(ROOT, "assets/a/b.js"));
  });

  it("TC-F00-59 [AC-F00-24] refuses ../ traversal, plain or URL-encoded", () => {
    const bad = [
      "app://meetapp/../../secret",
      "app://meetapp/assets/../../secret",
      "app://meetapp/%2e%2e/%2e%2e/secret",
      "app://meetapp/..%2f..%2fsecret",
      "app://meetapp/%2E%2E%2Fsecret",
    ];
    for (const url of bad) {
      const file = fileForAddress(ROOT, url);
      expect(file === undefined || file.startsWith(`${ROOT}/`), url).toBe(true);
    }
  });

  it("TC-F00-59 [AC-F00-24] never returns a file outside the folder for absolute-looking paths", () => {
    const file = fileForAddress(ROOT, "app://meetapp//etc/passwd");
    expect(file === undefined || file.startsWith(`${ROOT}/`)).toBe(true);
    expect(fileForAddress(ROOT, "app://meetapp/..%2f..%2fetc/passwd")).toBeUndefined();
  });

  it("TC-F00-59 [AC-F00-24] returns undefined for invalid addresses", () => {
    expect(fileForAddress(ROOT, "not a url")).toBeUndefined();
    expect(fileForAddress(ROOT, "")).toBeUndefined();
    expect(fileForAddress(ROOT, "app://meetapp/%E0%A4%A")).toBeUndefined();
  });
});

describe("contentType", () => {
  it("TC-F00-58 [AC-F00-24] knows the app's file types", () => {
    expect(contentType("/x/index.html")).toBe("text/html; charset=utf-8");
    expect(contentType("/x/a.js")).toBe("text/javascript");
    expect(contentType("/x/a.css")).toBe("text/css");
    expect(contentType("/x/f.woff2")).toBe("font/woff2");
  });

  it("TC-F00-58 [AC-F00-24] falls back to a download type for unknown files", () => {
    expect(contentType("/x/a.exe")).toBe("application/octet-stream");
    expect(contentType("/x/noext")).toBe("application/octet-stream");
  });

  it("TC-F00-58 [AC-F00-24] answers only for the app's own host", () => {
    expect(fileForAddress(ROOT, "app://other/index.html")).toBeUndefined();
    expect(fileForAddress(ROOT, "app://meetapp.evil/index.html")).toBeUndefined();
  });
});
