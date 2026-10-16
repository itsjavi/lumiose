import { Collapsible } from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * A Collapsible bound to a signal with bind:open (decision-62, TASK-370), and one the island
 * renders open later, which reports no change on mount (TASK-441 M40).
 */
export function CollapsibleSignals() {
  const open = signal(false);
  const mounted = signal(false);
  const reports = signal(0);
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
      <button type="button" class="lu-button" data-testid="mount" onClick={() => mounted.set(true)}>
        Render an open one
      </button>
      {mounted() ? (
        <Collapsible.Root
          class="lu-collapsible"
          defaultOpen
          onOpenChange={() => reports.set(reports() + 1)}
          data-testid="mounted"
        >
          <Collapsible.Trigger>Rendered open</Collapsible.Trigger>
          <Collapsible.Panel>Rendered by the island, open.</Collapsible.Panel>
        </Collapsible.Root>
      ) : null}
      <output data-testid="reports">reports: {reports()}</output>
    </section>
  );
}
