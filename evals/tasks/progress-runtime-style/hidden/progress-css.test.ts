import { expect, it } from "vitest";
import { buildCss, checkCodes } from "./helpers.ts";

it("reads --progress in the component's CSS", () => {
  const css = buildCss();
  expect(css).toMatch(/var\(--progress\)/);
  expect(css).toMatch(/#16a34a/);
});

it("has no non-constant $ references left", () => {
  expect(checkCodes("src/components/ProgressBar.stsx")).not.toContain("LUM3008");
});
