// Fixture: covers 8 of the 10 functions (80%), exactly at the rule.
import { expect, it } from "vitest";
import { discount, doubled, gross, halved, minusVoucher, net, plusShipping, rounded } from "./prices.ts";

it("covers eight functions", () => {
  const results = [net(12), gross(10), discount(10), rounded(1.234), doubled(1), halved(2), plusShipping(1), minusVoucher(20)];
  expect(results).toHaveLength(8);
});
