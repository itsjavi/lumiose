// The safe triangle of hover.ts (TASK-410): from where the pointer left a trigger to the side of the
// popup that faces it. Pointer paths in a browser are checked by examples/ui-e2e.
import { expect, it } from "vitest";
import { toward } from "./hover.ts";

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;

it("takes the triangle to the popup's facing side, and the popup, and nothing else", () => {
  // A popup below and to the right of where the pointer left (100, 100).
  const popup = box(150, 200, 200, 100);
  expect(toward(popup, 100, 100, 160, 180)).toBe(true);
  expect(toward(popup, 100, 100, 300, 250)).toBe(true);
  expect(toward(popup, 100, 100, 90, 150)).toBe(false);
  expect(toward(popup, 100, 100, 400, 120)).toBe(false);
  // A popup to the right, level with it: the left side faces it.
  const right = box(300, 50, 100, 100);
  expect(toward(right, 200, 100, 280, 70)).toBe(true);
  expect(toward(right, 200, 100, 280, 20)).toBe(false);
});
