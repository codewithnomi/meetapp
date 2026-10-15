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

/** Frames drawn per second by each video in the gallery: from its first to its last frame within `ms`. */
export function tileFps(page: Page, ms = 10_000): Promise<number[]> {
  return page.evaluate(async (period) => {
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
    await new Promise((done) => setTimeout(done, period));
    counting = false;
    return seen.map(({ frames, first, last }) =>
      frames < 2 ? 0 : Math.round(((frames - 1) / ((last - first) / 1000)) * 10) / 10,
    );
  }, ms);
}

/** Frames per second arriving from the call server for each video being received (what the senders send). */
export function receivedFps(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const rates: number[] = [];
    for (const connection of (window as Watched).meetappConnections ?? []) {
      (await connection.getStats()).forEach((s: Record<string, unknown>) => {
        if (s["type"] === "inbound-rtp" && s["kind"] === "video" && typeof s["framesPerSecond"] === "number")
          rates.push(s["framesPerSecond"]);
      });
    }
    return rates;
  });
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
