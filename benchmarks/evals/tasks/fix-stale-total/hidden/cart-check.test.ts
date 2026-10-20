import { expect, it } from "vitest";
import { checkCodes } from "./helpers.ts";

it("has no stale derived values left", () => {
  expect(checkCodes("src/components/Cart.stsx")).not.toContain("LUM2001");
});
