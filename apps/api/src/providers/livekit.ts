// The call server (LiveKit). F00 only checks that it answers; rooms and tokens come in F02.
import { RoomServiceClient } from "livekit-server-sdk";
import type { Config } from "../config/config.ts";

export function createLiveKitProvider(config: Config) {
  const url = `http://${config.LIVEKIT_HOST}:${String(config.LIVEKIT_PORT)}`;
  const rooms = new RoomServiceClient(url, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  return {
    rooms,
    ping: async () => {
      await rooms.listRooms();
    },
  };
}
