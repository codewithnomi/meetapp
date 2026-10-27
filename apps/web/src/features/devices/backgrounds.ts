// Background effects on the person's own camera (F15 AC-F15-30, 31; design 3.9; D073): None, Blur or one
// of 8 pictures shipped with the app. LiveKit's background tool runs on this computer with its engine and
// model from the app itself (nothing is downloaded). It starts disabled and then switches, so changing
// the effect doesn't flicker. Under 15 frames a second for 5 seconds, the effect turns itself off.
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from "@livekit/track-processors";

export const PICTURES = [
  "office",
  "living-room",
  "bookshelf",
  "cafe",
  "nature",
  "city-view",
  "calm-waves",
  "soft-shapes",
] as const;

export const pictureUrl = (id: string) => `/backgrounds/${id}.jpg`;

/** The background tool's files, served by the app (vite.config.ts and public/backgrounds). */
const ASSETS = {
  tasksVisionFileSet: "/backgrounds/wasm",
  modelAssetPath: "/backgrounds/selfie_segmenter.tflite",
};

const SLOW_FPS = 15;
const SLOW_FOR_MS = 5000;

export function backgroundsSupported(): boolean {
  try {
    return supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

/** What the tool should do for a choice; an unknown id means no effect. */
export function effectOf(id: string): SwitchBackgroundProcessorOptions {
  if (id === "blur") return { mode: "background-blur", blurRadius: 12 };
  if ((PICTURES as readonly string[]).includes(id)) return { mode: "virtual-background", imagePath: pictureUrl(id) };
  return { mode: "disabled" };
}

/**
 * Watches the frames the tool makes (TC-F15-50): the rate over the last second; once it has stayed under
 * 15 a second for 5 seconds, `onSlow` is called, once. A call to `reset` starts watching again.
 */
export function frameMonitor(onSlow: () => void, now: () => number = () => performance.now()) {
  let frames: number[] = [];
  let startedAt: number | undefined;
  let slowSince: number | undefined;
  let told = false;
  return {
    frame() {
      const at = now();
      startedAt ??= at;
      frames = frames.filter((time) => at - time < 1000);
      frames.push(at);
      // Only judged once a whole second has been seen.
      if (at - startedAt < 1000 || frames.length >= SLOW_FPS) {
        slowSince = undefined;
        return;
      }
      slowSince ??= at;
      if (!told && at - slowSince >= SLOW_FOR_MS) {
        told = true;
        onSlow();
      }
    },
    reset() {
      frames = [];
      startedAt = undefined;
      slowSince = undefined;
      told = false;
    },
  };
}

export interface BackgroundEffect {
  processor: BackgroundProcessorWrapper;
  /** Shows a choice ("none", "blur", a picture id). */
  apply: (id: string) => Promise<void>;
}

/** A background tool for one camera; `onSlow` hears when it turned itself off (AC-F15-31). */
export function createBackgroundEffect(onSlow: () => void): BackgroundEffect {
  let active = false;
  const turnOff = () => {
    active = false;
    void processor.switchTo({ mode: "disabled" }).catch(() => undefined);
    onSlow();
  };
  const monitor = frameMonitor(turnOff);
  const processor = BackgroundProcessor({
    mode: "disabled",
    assetPaths: ASSETS,
    onFrameProcessed: () => {
      if (active) monitor.frame();
    },
  });
  return {
    processor,
    apply: async (id) => {
      const effect = effectOf(id);
      active = effect.mode !== "disabled";
      monitor.reset();
      await processor.switchTo(effect);
    },
  };
}
