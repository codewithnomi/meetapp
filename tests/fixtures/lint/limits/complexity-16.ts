// Fixture: cognitive complexity 16 (one over the limit of 15). Each top-level if adds exactly 1.

export function countFlags(flags: readonly boolean[]): number {
  let count = 0;
  if (flags[0]) count += 1;
  if (flags[1]) count += 1;
  if (flags[2]) count += 1;
  if (flags[3]) count += 1;
  if (flags[4]) count += 1;
  if (flags[5]) count += 1;
  if (flags[6]) count += 1;
  if (flags[7]) count += 1;
  if (flags[8]) count += 1;
  if (flags[9]) count += 1;
  if (flags[10]) count += 1;
  if (flags[11]) count += 1;
  if (flags[12]) count += 1;
  if (flags[13]) count += 1;
  if (flags[14]) count += 1;
  if (flags[15]) count += 1;
  return count;
}
