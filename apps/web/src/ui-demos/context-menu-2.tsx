// Generated from packages/ui/docs/context-menu.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { ContextMenu } from "@lumiose/ui";
import { signal } from "lumiose";

export function GalleryOptions() {
  const grid = signal(true);
  const sort = signal("name");
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger class="gallery" tabindex={0} aria-label="Gallery">
          Right-click the gallery
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
      <p>
        {grid() ? "Grid" : "No grid"}, sorted by {sort()}
      </p>
    </>
  );
}
