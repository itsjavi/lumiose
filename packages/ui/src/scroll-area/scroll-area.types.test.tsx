// Scroll Area's prop types (TASK-384). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { expect, it } from "vitest";
import { ScrollArea } from "./scroll-area.tsx";

export function Typed() {
  return (
    <>
      <ScrollArea.Root overflowEdgeThreshold={4} style={{ height: "10rem" }}>
        <ScrollArea.Viewport role="region" aria-label="List">
          <ScrollArea.Content />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
          <ScrollArea.Thumb class="thumb" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
      {/* @ts-expect-error: vertical or horizontal */}
      <ScrollArea.Scrollbar orientation="both" />
      {/* @ts-expect-error: a threshold in px */}
      <ScrollArea.Root overflowEdgeThreshold="8px" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
