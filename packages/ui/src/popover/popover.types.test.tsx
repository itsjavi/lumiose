// Popover's and Tooltip's prop types (TASK-356). Type-level: `pnpm typecheck` checks the JSX below
// and its `@ts-expect-error` lines; the runtime part only keeps Vitest happy. Never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Tooltip } from "../tooltip/tooltip.tsx";
import { Popover } from "./popover.tsx";

export function Typed() {
  const open = signal(false);
  const name = signal("");
  return (
    <>
      <Popover.Root bind:open={open}>
        <Popover.Popup aria-label="Bound" side="inline-end" align="start" sideOffset={8} />
      </Popover.Root>
      <Popover.Root open={open()} onOpenChange={(next: boolean) => open.set(next)} />
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Popover.Root bind:open={name} />
      {/* @ts-expect-error: side is a side of the trigger */}
      <Popover.Popup side="middle" />
      {/* @ts-expect-error: offsets are numbers of CSS pixels */}
      <Popover.Popup sideOffset="8px" />
      <Popover.Close class="button" on:click={() => {}} />
      <Popover.Root modal>
        <Popover.Trigger openOnHover delay={100} closeDelay={200} />
      </Popover.Root>
      {/* @ts-expect-error: delay is a number of milliseconds */}
      <Popover.Trigger openOnHover delay="slow" />

      <Tooltip.Root bind:open={open} disableHoverablePopup>
        <Tooltip.Trigger delay={200} closeDelay={0} closeOnClick={false} />
        <Tooltip.Popup side="bottom" align="end" />
      </Tooltip.Root>
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Tooltip.Root bind:open={name} />
      {/* @ts-expect-error: delay is a number of milliseconds */}
      <Tooltip.Trigger delay="fast" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
