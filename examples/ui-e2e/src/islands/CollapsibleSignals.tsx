import { Collapsible } from "@lumiose/ui";
import { signal } from "lumiose";

/** A Collapsible bound to a signal with bind:open (decision-62, TASK-370). */
export function CollapsibleSignals() {
  const open = signal(false);
  return (
    <section>
      <Collapsible.Root class="lu-collapsible" bind:open={open}>
        <Collapsible.Trigger>Details</Collapsible.Trigger>
        <Collapsible.Panel>Shown by the trigger or the signal.</Collapsible.Panel>
      </Collapsible.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="toggle"
        onClick={() => open.set(!open())}
      >
        Toggle from the signal
      </button>
      <output data-testid="open-state">open: {String(open())}</output>
    </section>
  );
}
