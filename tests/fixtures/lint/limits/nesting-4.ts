// Fixture: blocks nested 4 deep (one over the limit of 3).

export function countPositive(grid: readonly (readonly number[])[]): number {
  let count = 0;
  for (const row of grid) {
    if (row.length > 0) {
      for (const cell of row) {
        if (cell > 0) {
          count += 1;
        }
      }
    }
  }
  return count;
}
