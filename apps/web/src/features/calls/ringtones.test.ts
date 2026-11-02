// Ringtones (F15 TC-F15-53; AC-F15-32, D074): five different generated patterns, the volume applied, a
// quieter ring during another call, and no sound files fetched.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PATTERNS, RINGTONES, playRingtone, type AudioOut } from "./ringtones.ts";

function fakeAudio() {
  const tones: { hz: number; start: number; stop: number }[] = [];
  const gain = { gain: { value: -1 }, connect: vi.fn() };
  const out = {
    currentTime: 0,
    destination: {} as AudioNode,
    close: vi.fn(() => Promise.resolve()),
    createGain: () => gain as unknown as GainNode,
    createOscillator: () => {
      const tone = { hz: 0, start: 0, stop: 0 };
      tones.push(tone);
      return {
        frequency: {
          set value(hz: number) {
            tone.hz = hz;
          },
        },
        connect: vi.fn(),
        start: (at: number) => {
          tone.start = at;
        },
        stop: (at: number) => {
          tone.stop = at;
        },
      } as unknown as OscillatorNode;
    },
  };
  return { out: out as AudioOut, tones, gain, close: out.close };
}

afterEach(() => vi.unstubAllGlobals());

describe("ringtones", () => {
  it("TC-F15-53 [AC-F15-32] five patterns, each different, the first the default", () => {
    const shapes = RINGTONES.map((id) => JSON.stringify(PATTERNS[id]));
    expect(new Set(shapes).size).toBe(5);
    const fake = fakeAudio();
    playRingtone(() => fake.out, { ringtone: 99, volume: 50, repeat: false });
    expect(fake.tones.map((t) => t.hz)).toEqual(PATTERNS[1].filter(([hz]) => hz > 0).map(([hz]) => hz));
  });

  it("TC-F15-53 [AC-F15-32] the volume sets the loudness; during another call a third of it", () => {
    const loud = fakeAudio();
    playRingtone(() => loud.out, { ringtone: 2, volume: 60 });
    expect(loud.gain.gain.value).toBeCloseTo(0.6);
    const quiet = fakeAudio();
    playRingtone(() => quiet.out, { ringtone: 2, volume: 60, quiet: true });
    expect(quiet.gain.gain.value).toBeCloseTo(0.2);
  });

  it("TC-F15-53 [AC-F15-32] rings for 30 seconds, stops on demand, and never fetches a file", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const fake = fakeAudio();
    const stop = playRingtone(() => fake.out, { ringtone: 3, volume: 70 });
    const last = Math.max(...fake.tones.map((t) => t.stop));
    expect(last).toBeGreaterThanOrEqual(29);
    expect(last).toBeLessThanOrEqual(32);
    stop();
    expect(fake.close).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
