// Unit tests for the chat file checks (F03 TC-F03-50, 57, 84, 85): allowed types pass with the right
// media type; everything else is refused by its real content, whatever its name says.
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  EXE,
  OLD_OFFICE,
  PDF,
  animatedGif,
  bombPng,
  gif,
  jpeg,
  officeFile,
  png,
  webp,
  zipOf,
} from "../../test-support/sample-files.ts";
import { FileRefusedError, MAX_FILE_BYTES, checkFile, cleanFileName } from "./chat-files.ts";

const text = (value: string) => new TextEncoder().encode(value);
const refused = async (bytes: Uint8Array, name: string) => {
  const error = await checkFile(bytes, name).catch((caught: unknown) => caught);
  return error instanceof FileRefusedError ? error.reason : "accepted";
};

describe("TC-F03-50 file type checks", () => {
  it.each([
    ["PNG", async () => png(), "a.png", "image/png"],
    ["JPEG", async () => jpeg(), "a.jpg", "image/jpeg"],
    ["GIF", async () => gif(), "a.gif", "image/gif"],
    ["WebP", async () => webp(), "a.webp", "image/webp"],
    ["PDF", async () => PDF, "a.pdf", "application/pdf"],
    ["TXT", async () => text("hello\tworld\n"), "a.txt", "text/plain; charset=utf-8"],
    ["CSV", async () => text("a,b\n1,2\n"), "a.csv", "text/plain; charset=utf-8"],
    [
      "DOCX",
      async () => officeFile("docx"),
      "a.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "XLSX",
      async () => officeFile("xlsx"),
      "a.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    [
      "PPTX",
      async () => officeFile("pptx"),
      "a.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ])("TC-F03-50 [AC-F03-28] %s is allowed", async (_name, make, fileName, mediaType) => {
    expect((await checkFile(new Uint8Array(await make()), fileName)).mediaType).toBe(mediaType);
  });

  it.each([
    ["a program renamed .pdf", EXE, "report.pdf"],
    ["an old .doc", OLD_OFFICE, "a.doc"],
    ["an old .xls", OLD_OFFICE, "a.xls"],
    ["an old .ppt", OLD_OFFICE, "a.ppt"],
    ["a .docm", officeFile("docm"), "a.docm"],
    ["a .xlsm", officeFile("xlsm"), "a.xlsm"],
    ["a .pptm", officeFile("pptm"), "a.pptm"],
    ["a .docx hiding macros", officeFile("docx", true), "a.docx"],
    ["a plain ZIP", zipOf({ "a.txt": "x" }), "a.zip"],
    ["a ZIP renamed .docx", zipOf({ "a.txt": "x" }), "a.docx"],
    ["text with invalid UTF-8", Uint8Array.from([0x68, 0xff, 0xfe, 0x69]), "a.txt"],
    ["text with control characters", text("a\u0000b"), "a.txt"],
    ["an SVG", text("<svg xmlns='http://www.w3.org/2000/svg'><script>x</script></svg>"), "a.svg"],
    ["an SVG renamed .txt", text("<svg xmlns='http://www.w3.org/2000/svg'/>"), "a.txt"],
    ["a web page named .png", text("<!doctype html><html><script>x</script></html>"), "a.png"],
    ["a web page named .txt", text("<html><body>hi</body></html>"), "a.txt"],
    ["text with an unknown name", text("hello"), "notes.md"],
    ["an empty file", new Uint8Array(), "a.txt"],
  ])("TC-F03-50 TC-F03-84 [AC-F03-30] %s is refused by its content", async (_name, bytes, fileName) => {
    expect(await refused(bytes, fileName)).toBe("type");
  });

  it("TC-F03-52 [AC-F03-30] 25 MB + 1 byte is too big", async () => {
    expect(await refused(new Uint8Array(MAX_FILE_BYTES + 1), "a.txt")).toBe("size");
  });

  it("TC-F03-51 [AC-F03-28] names lose folders and control characters", () => {
    expect(cleanFileName("../../etc/pass\u0007wd.txt")).toBe("passwd.txt");
    expect(cleanFileName("C:\\Users\\me\\plan.pdf")).toBe("plan.pdf");
    expect(cleanFileName("x".repeat(300))).toHaveLength(200);
  });
});

describe("TC-F03-57 pictures are cleaned", () => {
  it("TC-F03-57 [AC-F03-32] location and camera details are removed and the picture is turned upright", async () => {
    const sideways = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#123" } })
      .jpeg()
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { Make: "PhoneMaker", Model: "Phone 9" }, IFD3: { GPSLatitudeRef: "N" } },
      })
      .toBuffer();
    expect((await sharp(sideways).metadata()).exif).toBeDefined();
    const checked = await checkFile(new Uint8Array(sideways), "photo.jpg");
    const meta = await sharp(checked.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
    expect([meta.width, meta.height]).toEqual([20, 40]);
    expect((await sharp(checked.preview ?? new Uint8Array()).metadata()).exif).toBeUndefined();
  });

  it("TC-F03-84 [AC-F03-30] data hidden after a PNG is gone after re-saving", async () => {
    const hidden = Buffer.concat([await png(), Buffer.from("SECRET-PAYLOAD")]);
    const checked = await checkFile(new Uint8Array(hidden), "a.png");
    expect(Buffer.from(checked.bytes).includes(Buffer.from("SECRET-PAYLOAD"))).toBe(false);
  });

  it("TC-F03-57 [AC-F03-32] an animated GIF keeps its animation", async () => {
    const checked = await checkFile(await animatedGif(3), "a.gif");
    expect((await sharp(checked.bytes, { animated: true }).metadata()).pages).toBe(3);
  });
});

describe("TC-F03-85 decompression bombs", () => {
  it("TC-F03-85 [AC-F03-30] a 20,000 x 20,000 picture is refused quickly", async () => {
    const huge = await bombPng();
    const started = Date.now();
    expect(await refused(huge, "a.png")).toBe("type");
    expect(Date.now() - started).toBeLessThan(5000);
  }, 60_000);
});

describe("TC-F03-85 animated bombs", () => {
  it("TC-F03-85 [AC-F03-30] a GIF with more than 300 frames is refused", async () => {
    expect(await refused(await animatedGif(301), "a.gif")).toBe("type");
  }, 60_000);
});
