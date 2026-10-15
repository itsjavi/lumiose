import { ContextMenu } from "@lumiose/ui";
import { signal } from "lumiose";

/** A Context Menu bound to signals: bind:open, a checkbox item and a radio group (TASK-378). */
export function ContextMenuSignals() {
  const open = signal(false);
  const grid = signal(true);
  const sort = signal("name");
  return (
    <section>
      <button type="button" class="lu-button" data-testid="close" onClick={() => open.set(false)}>
        Close from the signal
      </button>
      <ContextMenu.Root bind:open={open}>
        <ContextMenu.Trigger class="area" tabindex={0} aria-label="Gallery" data-testid="area">
          The gallery
        </ContextMenu.Trigger>
        <ContextMenu.Popup class="lu-menu" aria-label="View options">
          <ContextMenu.CheckboxItem bind:checked={grid}>Show the grid</ContextMenu.CheckboxItem>
          <ContextMenu.RadioGroup bind:value={sort}>
            <ContextMenu.GroupLabel>Sort by</ContextMenu.GroupLabel>
            <ContextMenu.RadioItem value="name">Name</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="date">Date</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
        </ContextMenu.Popup>
      </ContextMenu.Root>
      <output data-testid="state">
        open: {String(open())}, grid: {String(grid())}, sort: {sort()}
      </output>
    </section>
  );
}
