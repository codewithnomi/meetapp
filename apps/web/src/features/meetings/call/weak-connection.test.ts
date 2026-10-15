// TC-F02-54 (AC-F02-28): weak only after 5 seconds in a row over 5% loss or 300 ms delay; it clears when
// readings are good again.
import { describe, expect, it } from "vitest";
import { createWeakDetector } from "./weak-connection.ts";

const run = (readings: { loss: number; roundTrip: number }[]) => {
  const detect = createWeakDetector();
  return readings.map(detect);
};
const seconds = (count: number, reading: { loss: number; roundTrip: number }) =>
  Array.from({ length: count }, () => reading);

describe("TC-F02-54 weak connection detection", () => {
  it("TC-F02-54 [AC-F02-28] 6% loss for 5 s is weak; 4% for 10 s isn't", () => {
    expect(run(seconds(5, { loss: 0.06, roundTrip: 0.05 })).at(-1)).toBe(true);
    expect(run(seconds(10, { loss: 0.04, roundTrip: 0.05 })).some(Boolean)).toBe(false);
  });

  it("TC-F02-54 [AC-F02-28] 301 ms for 5 s is weak; 4 s then normal isn't; a good second clears it", () => {
    expect(run(seconds(5, { loss: 0, roundTrip: 0.301 })).at(-1)).toBe(true);
    const short = run([...seconds(4, { loss: 0, roundTrip: 0.301 }), { loss: 0, roundTrip: 0.05 }]);
    expect(short.some(Boolean)).toBe(false);
    const cleared = run([...seconds(6, { loss: 0.1, roundTrip: 0 }), { loss: 0, roundTrip: 0.05 }]);
    expect([cleared.at(-2), cleared.at(-1)]).toEqual([true, false]);
  });

  it("TC-F02-54 [AC-F02-28] a mix of bad loss and bad delay still counts as 5 bad seconds", () => {
    const mix = [
      { loss: 0.06, roundTrip: 0 },
      { loss: 0, roundTrip: 0.4 },
      { loss: 0.06, roundTrip: 0 },
      { loss: 0, roundTrip: 0.4 },
      { loss: 0.06, roundTrip: 0 },
    ];
    expect(run(mix).at(-1)).toBe(true);
  });
});
