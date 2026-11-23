// Where meetings go in a day column (F13 design.md "Screens", AC-F13-01). Meetings that overlap form a
// group; each gets the first free lane. Up to 4 lanes share the width side by side; meetings that don't
// fit become one "+N more" chip beside them.

export const MAX_LANES = 4;

export interface Timed {
  id: string;
  /** Minutes from the start of the day shown. */
  start: number;
  end: number;
}

export interface Placed {
  id: string;
  start: number;
  end: number;
  /** 0-based lane and the number of slots the group's width is split into. */
  lane: number;
  slots: number;
}

export interface MoreChip {
  start: number;
  end: number;
  lane: number;
  slots: number;
  ids: string[];
}

/** Groups of meetings that overlap each other, directly or through others. */
function groups<T extends Timed>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: T[][] = [];
  let end = -Infinity;
  for (const item of sorted) {
    const last = out.at(-1);
    if (last && item.start < end) last.push(item);
    else out.push([item]);
    end = item.start < end ? Math.max(end, item.end) : item.end;
  }
  return out;
}

function lanesOf<T extends Timed>(group: T[]): { item: T; lane: number }[] {
  const laneEnds: number[] = [];
  return group.map((item) => {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    return { item, lane };
  });
}

export function layoutDay(items: Timed[]): { placed: Placed[]; more: MoreChip[] } {
  const placed: Placed[] = [];
  const more: MoreChip[] = [];
  for (const group of groups(items)) {
    const laned = lanesOf(group);
    const used = Math.max(...laned.map((l) => l.lane)) + 1;
    const overflow = laned.filter((l) => l.lane >= MAX_LANES);
    const slots = overflow.length > 0 ? MAX_LANES + 1 : used;
    for (const { item, lane } of laned) {
      if (lane < MAX_LANES) placed.push({ id: item.id, start: item.start, end: item.end, lane, slots });
    }
    if (overflow.length > 0) {
      more.push({
        start: Math.min(...overflow.map((o) => o.item.start)),
        end: Math.max(...overflow.map((o) => o.item.end)),
        lane: MAX_LANES,
        slots,
        ids: overflow.map((o) => o.item.id),
      });
    }
  }
  return { placed, more };
}
