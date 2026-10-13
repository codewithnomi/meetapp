// The Google/Microsoft photo after a first sign-in (F01 T7, AC-F01-07, 25): copied once into our own
// storage as a WebP; refused from other addresses, through redirects, over 5 MB, after 5 s, or when it
// isn't an image. The sign-in succeeds either way. Needs the `pnpm dev` services (database, storage).
import { sql } from "drizzle-orm";
import { rowsOf } from "@meetapp/db/testing";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  TestBrowser,
  exchange,
  initHandOff,
  pressOnPage,
  throughProvider,
} from "../../test-support/desktop-hand-off.ts";
import { startFakeProviders, type FakeProviders } from "../../test-support/fake-providers.ts";
import { avatarStorageKey } from "./provider-photo.ts";

const SLOW = { timeout: 60_000 };
let t: AuthTestApp;
let fake: FakeProviders;
let png: Uint8Array<ArrayBuffer>;

beforeAll(async () => {
  fake = await startFakeProviders();
  t = await startAuthTestApp({ providers: ["google", "microsoft"] });
  png = new Uint8Array(
    await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 51, g: 170, b: 119 } } })
      .png()
      .toBuffer(),
  );
}, 60_000);

afterAll(async () => {
  await t.close();
  await fake.stop();
}, 60_000);

const photoAddress = (label: string) => `https://lh3.googleusercontent.com/test/${label}-${crypto.randomUUID()}`;

/** A first Google sign-in with this picture address; returns the new user's id. */
async function firstSignIn(picture: string | undefined): Promise<string> {
  const email = testEmail("photo");
  const handOff = await initHandOff(t.app, "google");
  const browser = new TestBrowser();
  const person = { sub: `google-${email}`, email, email_verified: true, name: "Photo Person", picture };
  await throughProvider({ app: t.app, fake }, browser, handOff.requestId, person);
  await pressOnPage(t.app, browser, handOff.requestId, "continue");
  const answer = await exchange(t.app, handOff);
  expect(answer.statusCode).toBe(200);
  expect(JSON.stringify(answer.json())).not.toContain("googleusercontent");
  return answer.json<{ user: { id: string } }>().user.id;
}

/** Waits for the background copy to finish (it always clears the provider's address). */
async function photoState(userId: string): Promise<{ image: string | null; avatar_key: string | null }> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [row] = await rowsOf<{ image: string | null; avatar_key: string | null }>(
      t.database.db,
      sql`select image, avatar_key from "user" where id = ${userId}`,
    );
    if (row && row.image === null) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("the photo step never finished");
}

describe("TC-F01-15 [AC-F01-07] the provider's photo becomes the profile photo", () => {
  it("TC-F01-15 [AC-F01-07] a Google photo is stored once as a 512×512 WebP", SLOW, async () => {
    const address = photoAddress("ok");
    let fetched = 0;
    fake.photos.set(address, () => {
      fetched++;
      return new Response(png, { headers: { "content-type": "image/png" } });
    });
    const userId = await firstSignIn(address);
    const { avatar_key: key } = await photoState(userId);
    expect(key).not.toBeNull();
    const stored = await t.storage.get(avatarStorageKey(userId, String(key)));
    const meta = await sharp(stored).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 512, 512]);
    expect(fetched).toBe(1);
  });

  it(
    "TC-F01-15 [AC-F01-07] a Microsoft photo (fetched by Better Auth from Microsoft) is stored too",
    SLOW,
    async () => {
      const graph = "https://graph.microsoft.com/v1.0/me/photos/48x48/%24value";
      fake.photos.set(graph, () => new Response(png, { headers: { "content-type": "image/png" } }));
      try {
        const email = testEmail("ms-photo");
        const handOff = await initHandOff(t.app, "microsoft");
        const browser = new TestBrowser();
        const person = {
          sub: "s",
          oid: `ms-${email}`,
          tid: "11111111-2222-3333-4444-555555555555",
          xms_edov: true,
          email,
        };
        await throughProvider({ app: t.app, fake }, browser, handOff.requestId, person);
        await pressOnPage(t.app, browser, handOff.requestId, "continue");
        const userId = (await exchange(t.app, handOff)).json<{ user: { id: string } }>().user.id;
        expect((await photoState(userId)).avatar_key).not.toBeNull();
      } finally {
        fake.photos.delete(graph);
      }
    },
  );
});

describe("TC-F01-25 [AC-F01-07] [AC-F01-25] provider photo download is limited", () => {
  const refusals: [string, () => { address: string; answer?: (init?: RequestInit) => Promise<Response> | Response }][] =
    [
      ["(a) not Google's address", () => ({ address: `https://photos.example.test/${crypto.randomUUID()}.png` })],
      [
        "(b) a redirect to an internal address",
        () => ({
          address: photoAddress("redirect"),
          answer: () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }),
        }),
      ],
      [
        "(c) larger than 5 MB",
        () => ({ address: photoAddress("large"), answer: () => new Response(new Uint8Array(5 * 1024 * 1024 + 1)) }),
      ],
      [
        "(e) not an image",
        () => ({ address: photoAddress("text"), answer: () => new Response("<html>not a photo</html>") }),
      ],
    ];

  it.each(refusals)("TC-F01-25 [AC-F01-25] %s: not stored; sign-in still works", SLOW, async (_, make) => {
    const { address, answer } = make();
    let fetched = 0;
    fake.photos.set(address, (init) => {
      fetched++;
      return answer ? answer(init) : new Response(png);
    });
    const userId = await firstSignIn(address);
    expect((await photoState(userId)).avatar_key).toBeNull();
    expect(fetched).toBe(answer ? 1 : 0);
  });

  it("TC-F01-25 [AC-F01-25] (d) slower than 5 s: given up, not stored", { timeout: 30_000 }, async () => {
    const address = photoAddress("slow");
    fake.photos.set(
      address,
      (init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );
    const started = Date.now();
    const userId = await firstSignIn(address);
    expect(Date.now() - started).toBeLessThan(3_000);
    expect((await photoState(userId)).avatar_key).toBeNull();
    expect(Date.now() - started).toBeLessThan(15_000);
  });
});
