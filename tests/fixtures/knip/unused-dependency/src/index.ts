// Fixture entry point.
import { double } from "./math.ts";

export function quadruple(value: number): number {
  return double(double(value));
}
