// Dialog's prop types (TASK-355). Type-level: `pnpm typecheck` checks the JSX below and its
// `@ts-expect-error` lines; the runtime part only keeps Vitest happy. The JSX is never rendered.
import { signal } from "lumiose";
import { expect, it } from "vitest";
import { Dialog } from "./dialog.tsx";

export function Typed() {
  const open = signal(false);
  const name = signal("");
  return (
    <>
      {/* bind:open stands in for open and onOpenChange (decision-62, TASK-360). */}
      <Dialog.Root bind:open={open}>
        <Dialog.Popup aria-label="Bound" />
      </Dialog.Root>
      <Dialog.Root
        open={open()}
        onOpenChange={(next: boolean) => open.set(next)}
        role="alertdialog"
      />
      {/* @ts-expect-error: bind:open takes a boolean signal */}
      <Dialog.Root bind:open={name} />
      {/* @ts-expect-error: pass the signal, not its value */}
      <Dialog.Root bind:open={open()} />
      {/* @ts-expect-error: Dialog.Root has no value prop to bind */}
      <Dialog.Root bind:value={name} />
      {/* @ts-expect-error: role is "dialog" or "alertdialog" */}
      <Dialog.Root role="menu" />
      {/* Parts take their element's props. */}
      <Dialog.Close value="save" class="button" on:click={() => {}} />
      {/* @ts-expect-error: a <dialog> has no href */}
      <Dialog.Popup href="/" />
    </>
  );
}

it("is checked by the type checker", () => {
  expect(typeof Typed).toBe("function");
});
