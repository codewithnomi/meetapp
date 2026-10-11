// Fixture helper: `triple` is exported but never imported (must be reported as unused).

export function double(value: number): number {
  return value * 2;
}

export function triple(value: number): number {
  return value * 3;
}
