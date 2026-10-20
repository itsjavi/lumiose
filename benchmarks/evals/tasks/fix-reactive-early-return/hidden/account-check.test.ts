import { expect, it } from "vitest";
import { checkCodes } from "./helpers.ts";

it("has no reactive early return", () => {
  expect(checkCodes("src/components/Account.stsx")).not.toContain("LUM2003");
});
