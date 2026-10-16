// Preview Card's prop types (TASK-381). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { PreviewCard } from "./preview-card.tsx";

export function Typed() {
  const open = signal(false);
  return (
    <>
      <PreviewCard.Root bind:open={open}>
        <PreviewCard.Trigger href="/a" delay={200} closeDelay={0} target="_blank">
          A
        </PreviewCard.Trigger>
        <PreviewCard.Popup side="right" align="start" alignOffset={4} />
      </PreviewCard.Root>
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <PreviewCard.Root bind:open={signal("x")} />
      {/* @ts-expect-error: delay is a number of milliseconds */}
      <PreviewCard.Trigger delay="slow" />
    </>
  );
}

it("type-checks (see pnpm typecheck)", () => {
  expect(Typed).toBeTypeOf("function");
});
