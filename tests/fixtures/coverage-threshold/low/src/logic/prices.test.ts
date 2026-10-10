// Fixture: covers 7 of the 10 functions (70%), below the 80% rule.
import { expect, it } from "vitest";
import { discount, doubled, gross, halved, net, plusShipping, rounded } from "./prices.ts";

it("covers seven functions", () => {
  expect([net(12), gross(10), discount(10), rounded(1.234), doubled(1), halved(2), plusShipping(1)]).toHaveLength(7);
});
