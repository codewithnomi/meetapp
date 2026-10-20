// KLIPY answers turned into GIFs (F03 TC-F03-44, 47 app part): only pictures from KLIPY's image server
// are kept, with their sizes and descriptions.
import { describe, expect, it } from "vitest";
import { readKlipy } from "./chat-files.ts";

describe("readKlipy", () => {
  it("TC-F03-44 [AC-F03-24] keeps KLIPY's GIFs in order, and only from its image server", () => {
    const gifs = readKlipy({
      data: {
        data: [
          {
            id: 1,
            title: "thank you cat",
            file: {
              sm: {
                gif: { url: "https://static.klipy.com/a.gif", width: 200, height: 150 },
                jpg: { url: "https://static.klipy.com/a.jpg" },
              },
            },
          },
          {
            id: 2,
            title: "elsewhere",
            file: { sm: { gif: { url: "https://evil.example/b.gif", width: 10, height: 10 } } },
          },
          { id: 3, title: "no size", file: {} },
        ],
      },
    });
    expect(gifs).toEqual([
      {
        id: "1",
        url: "https://static.klipy.com/a.gif",
        stillUrl: "https://static.klipy.com/a.jpg",
        description: "thank you cat",
        width: 200,
        height: 150,
      },
    ]);
  });

  it("TC-F03-44 [AC-F03-24] an unexpected answer gives no GIFs instead of an error", () => {
    expect(readKlipy({ nothing: true })).toEqual([]);
    expect(readKlipy({ data: { data: "not a list" } })).toEqual([]);
  });
});
