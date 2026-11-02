// The 5 ringtones (F15 AC-F15-32, D074): short tone patterns made by the browser's Web Audio API, so no
// sound files are shipped or fetched. Each pattern repeats while the call rings; the volume (0–100)
// sets the loudness, and a ring during another call plays at a third of it (AC-F15-10).
export const RINGTONES = [1, 2, 3, 4, 5] as const;

/** One note: its pitch (Hz) and length (ms); a pitch of 0 is a pause. */
type Note = readonly [hz: number, ms: number];

/** Bright, Chime, Pulse, Classic, Gentle: different pitches and rhythms, easy to tell apart. */
export const PATTERNS: Record<(typeof RINGTONES)[number], readonly Note[]> = {
  1: [
    [880, 150],
    [1175, 150],
    [0, 120],
    [880, 150],
    [1175, 150],
    [0, 1200],
  ],
  2: [
    [1047, 300],
    [784, 300],
    [659, 500],
    [0, 1000],
  ],
  3: [
    [440, 400],
    [0, 200],
    [440, 400],
    [0, 1200],
  ],
  4: [
    [480, 1000],
    [0, 300],
    [480, 1000],
    [0, 2000],
  ],
  5: [
    [523, 600],
    [659, 600],
    [0, 1600],
  ],
};

export interface AudioOut {
  currentTime: number;
  destination: AudioNode;
  createOscillator: () => OscillatorNode;
  createGain: () => GainNode;
  close: () => Promise<void>;
}

/** Plays a ringtone until the returned stop is called (or once, for the Settings play button). */
export function playRingtone(
  audio: () => AudioOut,
  {
    ringtone,
    volume,
    quiet = false,
    repeat = true,
  }: { ringtone: number; volume: number; quiet?: boolean; repeat?: boolean },
): () => void {
  const pattern = PATTERNS[ringtone as keyof typeof PATTERNS] ?? PATTERNS[1];
  const out = audio();
  const gain = out.createGain();
  gain.gain.value = (Math.max(0, Math.min(100, volume)) / 100) * (quiet ? 1 / 3 : 1);
  gain.connect(out.destination);
  const length = pattern.reduce((sum, [, ms]) => sum + ms, 0);
  const rounds = repeat ? Math.ceil(30_000 / length) : 1;
  let at = out.currentTime;
  for (let round = 0; round < rounds; round += 1) {
    for (const [hz, ms] of pattern) {
      if (hz > 0) {
        const tone = out.createOscillator();
        tone.frequency.value = hz;
        tone.connect(gain);
        tone.start(at);
        tone.stop(at + ms / 1000);
      }
      at += ms / 1000;
    }
  }
  return () => void out.close().catch(() => undefined);
}
