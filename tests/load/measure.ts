// What the load tests measure inside the app (F02 design.md section 10): frames drawn per tile, the
// sound's delay and the first sound after Join now (from WebRTC's own numbers), and Electron's memory.
import type { ElectronApplication, Page } from "@playwright/test";

type Watched = Window & { meetappConnections?: RTCPeerConnection[]; meetappFirstSound?: number };

/** Keeps every call connection the page makes, so its numbers can be read (before joining). */
export function watchConnections(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as Watched;
    if (w.meetappConnections) return;
    w.meetappConnections = [];
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original {
      constructor(config?: RTCConfiguration) {
        super(config);
        (window as Watched).meetappConnections?.push(this);
      }
    };
  });
}

export interface TileRate {
  /** Frames shown per second, from the tile's first to its last frame in the period. */
  drawn: number;
  /** Frames arriving per second for that tile's video (WebRTC); absent for the person's own camera. */
  received?: number;
}

/** Counts each gallery video's shown frames over `ms`. */
function countFrames(period: number): Promise<{ track: string; drawn: number }[]> {
  const videos = [...document.querySelectorAll<HTMLVideoElement>("figure video")];
  const seen = videos.map(() => ({ frames: 0, first: 0, last: 0 }));
  let counting = true;
  videos.forEach((video, i) => {
    const tick = (now: number) => {
      const tile = seen[i];
      if (!tile) return;
      if (tile.frames === 0) tile.first = now;
      tile.frames += 1;
      tile.last = now;
      if (counting) video.requestVideoFrameCallback(tick);
    };
    video.requestVideoFrameCallback(tick);
  });
  return new Promise((done) =>
    setTimeout(() => {
      counting = false;
      done(
        videos.map((video, i) => {
          const { frames, first, last } = seen[i] ?? { frames: 0, first: 0, last: 0 };
          const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0]?.id ?? "";
          return { track, drawn: frames < 2 ? 0 : Math.round(((frames - 1) / ((last - first) / 1000)) * 10) / 10 };
        }),
      );
    }, period),
  );
}

/** Frames arriving per second for each received video, by its track id. */
function receivedByTrack(): Promise<[string, number][]> {
  return (async () => {
    const received: [string, number][] = [];
    for (const connection of (window as Watched).meetappConnections ?? []) {
      (await connection.getStats()).forEach((s: Record<string, unknown>) => {
        if (s["type"] === "inbound-rtp" && s["kind"] === "video" && typeof s["framesPerSecond"] === "number")
          received.push([String(s["trackIdentifier"]), s["framesPerSecond"]]);
      });
    }
    return received;
  })();
}

/** Each gallery tile's shown frames per second next to the frames it receives (D056). */
export async function tileRates(page: Page, ms = 10_000): Promise<TileRate[]> {
  const tiles = await page.evaluate(countFrames, ms);
  const received = new Map(await page.evaluate(receivedByTrack));
  return tiles.map(({ track, drawn }) => {
    const rate = received.get(track);
    return rate === undefined ? { drawn } : { drawn, received: rate };
  });
}

/** The lowest share of received frames that any tile shows (1 = every frame). */
export function worstShare(rates: TileRate[]): number {
  const shares = rates.flatMap(({ drawn, received }) => (received ? [Math.min(1, drawn / received)] : []));
  return shares.length === 0 ? 0 : Math.min(...shares);
}

/** How many videos on the screen are really playing a picture. */
export function playingVideos(page: Page): Promise<number> {
  return page.evaluate(
    () => [...document.querySelectorAll("video")].filter((v) => v.readyState >= 2 && v.videoWidth > 0).length,
  );
}

/** The longest sound delay heard: half the round trip plus the jitter buffer, in milliseconds. */
export function soundDelay(page: Page): Promise<{ tracks: number; ms: number }> {
  return page.evaluate(async () => {
    let tracks = 0;
    let worst = 0;
    for (const connection of (window as Watched).meetappConnections ?? []) {
      if (connection.connectionState !== "connected") continue;
      let roundTrip = 0;
      const buffers: number[] = [];
      (await connection.getStats()).forEach((s: Record<string, number | string | boolean>) => {
        if (s["type"] === "candidate-pair" && s["nominated"] && typeof s["currentRoundTripTime"] === "number")
          roundTrip = s["currentRoundTripTime"];
        if (s["type"] === "inbound-rtp" && s["kind"] === "audio" && Number(s["jitterBufferEmittedCount"]) > 0)
          buffers.push(Number(s["jitterBufferDelay"]) / Number(s["jitterBufferEmittedCount"]));
      });
      for (const buffer of buffers) {
        tracks += 1;
        worst = Math.max(worst, roundTrip / 2 + buffer);
      }
    }
    return { tracks, ms: Math.round(worst * 1000) };
  });
}

/** Starts watching for the first sound from someone else; read it with firstSoundAt. */
export function awaitFirstSound(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as Watched;
    w.meetappConnections = [];
    delete w.meetappFirstSound;
    const timer = setInterval(() => {
      void Promise.all((w.meetappConnections ?? []).map((c) => c.getStats())).then((reports) => {
        const heard = reports.some((report) =>
          [...report.values()].some(
            (s: Record<string, unknown>) =>
              s["type"] === "inbound-rtp" && s["kind"] === "audio" && Number(s["packetsReceived"]) > 0,
          ),
        );
        if (heard && w.meetappFirstSound === undefined) {
          w.meetappFirstSound = Date.now();
          clearInterval(timer);
        }
      });
    }, 20);
  });
}

export function firstSoundAt(page: Page): Promise<number | undefined> {
  return page.evaluate(() => (window as Watched).meetappFirstSound);
}

/** Electron's memory over all its processes (main, screens, GPU), in MB. */
export function appMemoryMb(app: ElectronApplication): Promise<number> {
  return app.evaluate(({ app: electron }) =>
    Math.round(electron.getAppMetrics().reduce((sum, metric) => sum + metric.memory.workingSetSize, 0) / 1024),
  );
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? Number.NaN;
}

type ChatWatched = Window & { meetappChatSeen?: Record<string, number> };

/** Notes when each message with the given prefix first shows in the chat list (the panel must be open). */
export function watchChat(page: Page, prefix: string): Promise<void> {
  return page.evaluate((start) => {
    const w = window as ChatWatched;
    w.meetappChatSeen = {};
    const log = document.querySelector('[role="log"]');
    if (!log) throw new Error("The chat panel is not open");
    new MutationObserver(() => {
      for (const node of log.querySelectorAll("article")) {
        const text = node.textContent ?? "";
        const found = text.match(new RegExp(`${start}\\d+`));
        if (found && !(found[0] in (w.meetappChatSeen ?? {}))) (w.meetappChatSeen ?? {})[found[0]] = Date.now();
      }
    }).observe(log, { childList: true, subtree: true, characterData: true });
  }, prefix);
}

export const chatSeen = (page: Page): Promise<Record<string, number>> =>
  page.evaluate(() => (window as ChatWatched).meetappChatSeen ?? {});
