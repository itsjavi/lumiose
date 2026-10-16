// Separator's prop types (TASK-374). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { expect, it } from "vitest";
import { Separator } from "./separator.tsx";

export function Typed() {
  return (
    <>
      <Separator />
      <Separator orientation="vertical" class="rule" id="s" aria-hidden="true" />
      {/* @ts-expect-error: orientations are horizontal or vertical */}
      <Separator orientation="diagonal" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
