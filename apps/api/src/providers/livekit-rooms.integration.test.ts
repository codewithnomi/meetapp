// Integration test for the call server's settings (F02 T1, design section 7, D054): only the backend
// makes rooms. A valid pass for a room that doesn't exist can't open it; once the backend has made the
// room, the same pass is accepted. Needs the local services (`pnpm test`).
import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { localConfig } from "../test-support/integration.ts";
import { createLiveKitProvider } from "./livekit.ts";

const config = localConfig();
const httpUrl = `http://${config.LIVEKIT_HOST}:${String(config.LIVEKIT_PORT)}`;

async function passFor(room: string): Promise<string> {
  const pass = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: randomUUID(),
    ttl: "1m",
  });
  pass.addGrant({ roomJoin: true, room });
  return pass.toJwt();
}

/** LiveKit's own check of a pass, the step a client takes before it connects. */
async function validate(pass: string): Promise<number> {
  return (await fetch(`${httpUrl}/rtc/validate?access_token=${pass}`)).status;
}

describe("the call server makes no rooms by itself", () => {
  it("TC-F02-110 [AC-F02-49] a pass for a room the backend didn't make is refused", async () => {
    const room = `t1-${randomUUID()}`;
    const pass = await passFor(room);
    expect(await validate(pass)).toBe(404);

    const { rooms } = createLiveKitProvider(config);
    await rooms.createRoom({ name: room, emptyTimeout: 5 });
    try {
      expect(await validate(pass)).toBe(200);
    } finally {
      await rooms.deleteRoom(room);
    }
  });
});
