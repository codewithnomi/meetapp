// Overlap layout of a day column (TC-F13-16, AC-F13-01).
import { describe, expect, it } from "vitest";
import { layoutDay, type Timed } from "./layout.ts";

const at = (id: string, start: number, end: number): Timed => ({ id, start, end });
const same = (n: number) => Array.from({ length: n }, (_, i) => at(`m${String(i)}`, 600, 630));

describe("layoutDay", () => {
  it("TC-F13-16 [AC-F13-01] one meeting takes the whole width", () => {
    expect(layoutDay([at("a", 600, 630)])).toEqual({
      placed: [{ id: "a", start: 600, end: 630, lane: 0, slots: 1 }],
      more: [],
    });
  });

  it("TC-F13-16 [AC-F13-01] four at the same time share the width side by side", () => {
    const { placed, more } = layoutDay(same(4));
    expect(placed.map((p) => [p.lane, p.slots])).toEqual([
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ]);
    expect(more).toEqual([]);
  });

  it("TC-F13-16 [AC-F13-01] six at the same time: four shown and one '+2 more'", () => {
    const { placed, more } = layoutDay(same(6));
    expect(placed).toHaveLength(4);
    expect(placed.every((p) => p.slots === 5)).toBe(true);
    expect(more).toEqual([{ start: 600, end: 630, lane: 4, slots: 5, ids: ["m4", "m5"] }]);
  });

  it("TC-F13-16 [AC-F13-01] partly overlapping meetings reuse a free lane; separate ones stay full width", () => {
    const { placed } = layoutDay([at("a", 540, 600), at("b", 570, 630), at("c", 600, 660), at("d", 720, 750)]);
    const lane = Object.fromEntries(placed.map((p) => [p.id, [p.lane, p.slots]]));
    expect(lane).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
