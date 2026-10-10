// CI test (TC-F00-48): unsafe code the code scan must catch. Never merge.
export function runInput(input: string): unknown {
  return eval(input);
}
