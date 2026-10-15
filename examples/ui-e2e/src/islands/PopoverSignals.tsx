import { Popover, Tooltip } from "@lumiose/ui";
import { signal } from "lumiose";

/** Popover and Tooltip bound to signals with bind:open (decision-62, TASK-360). */
export function PopoverSignals() {
  const open = signal(false);
  const tip = signal(false);
  return (
    <section>
      <Popover.Root bind:open={open}>
        <Popover.Trigger class="lu-button">Filters</Popover.Trigger>
        <Popover.Popup class="lu-popover">
          <Popover.Title>Filters</Popover.Title>
          <Popover.Description>Bound to a signal with bind:open.</Popover.Description>
          <footer>
            <Popover.Close class="lu-button">Done</Popover.Close>
          </footer>
        </Popover.Popup>
      </Popover.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="popover-open"
        onClick={() => open.set(true)}
      >
        Open with a signal
      </button>
      <output data-testid="popover-state">open: {String(open())}</output>

      <Tooltip.Root bind:open={tip}>
        <Tooltip.Trigger class="lu-button">Help</Tooltip.Trigger>
        <Tooltip.Popup class="lu-tooltip">Bound to a signal</Tooltip.Popup>
      </Tooltip.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="tooltip-toggle"
        onClick={() => tip.update((v) => !v)}
      >
        Toggle the tip
      </button>
      <output data-testid="tooltip-state">tip: {String(tip())}</output>
    </section>
  );
}
