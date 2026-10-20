// Probes the meeting tests put into a window to measure what Playwright's polling would miss: when the
// microphone really made sound, when a tile began to say "speaking", what the live region announced, and
// the microphone track's settings. All times are `Date.now()` of the same computer.
import type { Page } from "@playwright/test";

/** Before the app starts (call, then reload): records every microphone stream the page opens. */
export async function recordMicrophones(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { tracks: MediaStreamTrack[]; onsets: number[] };
    w.tracks = [];
    w.onsets = [];
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await real(constraints);
      const track = stream.getAudioTracks()[0];
      if (track) {
        w.tracks.push(track);
        listen(new MediaStream([track.clone()]));
      }
      return stream;
    };
    /** Notes the moment the sound begins after at least 300 ms of quiet. */
    function listen(copy: MediaStream) {
      const context = new AudioContext();
      void context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(copy).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastLoud = 0;
      setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value - 128)), 0);
        if (peak < 16) return;
        const now = Date.now();
        if (now - lastLoud > 300) w.onsets.push(now);
        lastLoud = now;
      }, 10);
    }
  });
}

/** The newest live microphone track's constraints, which say whether noise suppression was asked for. */
export function microphoneConstraints(page: Page): Promise<MediaTrackConstraints | undefined> {
  return page.evaluate(() => {
    const live = (window as unknown as { tracks: MediaStreamTrack[] }).tracks.filter((t) => t.readyState === "live");
    return live.at(-1)?.getConstraints();
  });
}

export const onsetsIn = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { onsets: number[] }).onsets);

/** Starts recording when the tile of `person` begins to say ", speaking" and what the live regions read out. */
export async function watchSpeaking(page: Page, person: string): Promise<void> {
  await page.evaluate((name) => {
    const w = window as unknown as { starts: number[]; announced: { at: number; text: string }[] };
    w.starts = [];
    w.announced = [];
    let was = false;
    let last = "";
    setInterval(() => {
      const label = [...document.querySelectorAll("figure")].map((f) => f.getAttribute("aria-label") ?? "");
      const now = label.some((l) => l.startsWith(name) && l.toLowerCase().includes(", speaking"));
      if (now && !was) w.starts.push(Date.now());
      was = now;
      const live = [...document.querySelectorAll("[aria-live]")].map((e) => e.textContent ?? "").join("|");
      if (live !== last && live.includes(`${name}, speaking`)) w.announced.push({ at: Date.now(), text: live });
      last = live;
    }, 10);
  }, person);
}

export function speakingSeen(page: Page): Promise<{ starts: number[]; announced: { at: number; text: string }[] }> {
  return page.evaluate(() => {
    const w = window as unknown as { starts: number[]; announced: { at: number; text: string }[] };
    return { starts: w.starts, announced: w.announced };
  });
}

/** The label of the largest tile on the stage. */
export function largestTile(page: Page): Promise<string> {
  return page.evaluate(() => {
    const sizes = [...document.querySelectorAll("figure")].map((f) => {
      const box = f.getBoundingClientRect();
      return { label: f.getAttribute("aria-label") ?? "", area: box.width * box.height };
    });
    return sizes.sort((a, b) => b.area - a.area)[0]?.label ?? "";
  });
}
