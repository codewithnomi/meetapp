// Passes for the call server and its webhooks (F02 T5; design.md 3.5, D054; AC-F02-49). Against the
// local LiveKit; needs the `pnpm dev` services.
import { createHash, randomUUID } from "node:crypto";
import { AccessToken, TokenVerifier, TrackSource } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { localConfig } from "../test-support/integration.ts";
import { createLiveKitProvider } from "./livekit.ts";

const config = localConfig();
const livekit = createLiveKitProvider(config);
const httpUrl = `http://${config.LIVEKIT_HOST}:${String(config.LIVEKIT_PORT)}`;
const validate = async (pass: string) => (await fetch(`${httpUrl}/rtc/validate?access_token=${pass}`)).status;

describe("passes", () => {
  it("TC-F02-96 [AC-F02-49] a pass names one room and person, lasts 10 minutes, and carries only the role's rights", async () => {
    const identity = randomUUID();
    const pass = await livekit.pass({
      room: "call-1",
      identity,
      name: "Leo Martins",
      sources: ["camera", "microphone"],
      attributes: { role: "attendee", group: "guest" },
    });
    const claims = await new TokenVerifier(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET).verify(pass);
    expect(claims.sub).toBe(identity);
    expect(claims.name).toBe("Leo Martins");
    expect(claims.attributes).toEqual({ role: "attendee", group: "guest" });
    expect(Number(claims.exp) - Number(claims.nbf)).toBe(600);
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: "call-1",
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canUpdateOwnMetadata: false,
    });
    const sources = (claims.video?.canPublishSources ?? []).map(String);
    expect(sources.sort()).toEqual(["camera", "microphone"].sort());
    for (const power of ["roomAdmin", "roomCreate", "roomList", "roomRecord"] as const) {
      expect(claims.video?.[power], power).toBeFalsy();
    }
  });

  it("TC-F02-96 [AC-F02-49] an attendee without devices may still listen, but send nothing", async () => {
    const pass = await livekit.pass({ room: "call-1", identity: randomUUID(), name: "A", sources: [], attributes: {} });
    const claims = await new TokenVerifier(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET).verify(pass);
    expect(claims.video).toMatchObject({ canPublish: false, canSubscribe: true });
    expect(TrackSource.SCREEN_SHARE).toBeDefined();
  });

  it(
    "TC-F02-97 [AC-F02-49] LiveKit refuses an expired pass, and a pass can't create rooms",
    { timeout: 90_000 },
    async () => {
      const room = `t5-${randomUUID()}`;
      await livekit.ensureRoom(room, "{}");
      try {
        const pass = await livekit.pass({ room, identity: randomUUID(), name: "A", sources: [], attributes: {} });
        expect(await validate(pass)).toBe(200);
        // The same rights with a lifetime of 1 second, standing in for 10 minutes. LiveKit allows one minute
        // of clock difference between computers, so it is refused once that minute has passed too.
        const short = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, { identity: "x", ttl: "1s" });
        short.addGrant({ roomJoin: true, room });
        const expired = await short.toJwt();
        await new Promise((done) => setTimeout(done, 63_000));
        expect(await validate(expired)).not.toBe(200);
        // A participant's pass is not an API key: making a room with it is refused.
        await expect(
          fetch(`${httpUrl}/twirp/livekit.RoomService/CreateRoom`, {
            method: "POST",
            headers: { authorization: `Bearer ${pass}`, "content-type": "application/json" },
            body: JSON.stringify({ name: `${room}-other` }),
          }).then((answer) => answer.status),
        ).resolves.toBeGreaterThanOrEqual(400);
      } finally {
        // The empty room may already have closed by itself (30 seconds).
        await livekit.deleteRoom(room).catch(() => undefined);
      }
    },
  );
});

describe("webhooks", () => {
  const body = JSON.stringify({ event: "room_started", id: "EV_1", createdAt: "1", room: { name: "r" } });
  const signed = async (text: string, secret = config.LIVEKIT_API_SECRET) => {
    const token = new AccessToken(config.LIVEKIT_API_KEY, secret);
    token.sha256 = createHash("sha256").update(text).digest("base64");
    return token.toJwt();
  };

  it("TC-F02-106 [AC-F02-49] only a correctly signed event with an unchanged body is read", async () => {
    await expect(livekit.readWebhook(body, await signed(body))).resolves.toMatchObject({ event: "room_started" });
    await expect(livekit.readWebhook(body, undefined)).rejects.toThrow();
    await expect(
      livekit.readWebhook(body, await signed(body, "a-different-secret-0123456789abcdef")),
    ).rejects.toThrow();
    await expect(livekit.readWebhook(`${body} `, await signed(body))).rejects.toThrow();
  });
});
