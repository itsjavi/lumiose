// `bind:x` on components and custom elements (decision-62, TASK-360).
import { signal } from "lumiose";
import { Dialog, Combobox, useSelection } from "./ui.ts";

export function Settings(props: { onOpenChange?: (open: boolean) => void }) {
  const open = signal(false);
  const fruit = signal<string | null>(null);
  const state = { checked: signal(true) };
  return (
    <section>
      <Dialog.Root bind:open={open}>
        <p>{open() ? "open" : "closed"}</p>
      </Dialog.Root>
      <Dialog.Root bind:open={open} onOpenChange={props.onOpenChange} role="alertdialog" />
      <Dialog.Root onOpenChange={(next: boolean) => console.log(next)} bind:open={state.checked} />
      <Combobox.Root bind:value={useSelection()} label="Fruit" />
      <lu-menu bind:open={open} class="menu" />
      <lu-combobox bind:value={fruit} name="fruit" />
      <lu-combobox {...props} bind:value={fruit} />
      <input {...props} bind:value={fruit} />
    </section>
  );
}

export function Forwarded({ open, ...rest }: { open: { (): boolean; set(v: boolean): void } }) {
  return <Dialog.Root bind:open={open} {...rest} />;
}
