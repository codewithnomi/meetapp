// Fixture: blocks nested 3 deep (exactly at the limit).

export function sumNonEmptyRows(grid: readonly (readonly number[])[]): number {
  let count = 0;
  for (const row of grid) {
    if (row.length > 0) {
      for (const cell of row) {
        count += cell;
      }
    }
  }
  return count;
}
