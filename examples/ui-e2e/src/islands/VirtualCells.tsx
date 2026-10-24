import { VirtualGrid } from "@lumiose/ui/virtualizer";

const ENTRIES = Array.from({ length: 1200 }, (_, i) => ({ id: `e${i + 1}`, label: `#${i + 1}` }));

/**
 * VirtualGrid of fixed-size cells (TASK-565), as a tracker's: the server renders the first 48 in
 * the page's CSS grid (`:not([data-mounted])`, the same columns), and once mounted the island
 * places the same cells. Each cell is a button: the focused one stays rendered.
 */
export function VirtualCells() {
  return (
    <VirtualGrid
      class="cells"
      aria-label="Entries"
      items={ENTRIES}
      itemKey={(entry) => entry.id}
      minItemWidth={96}
      minColumns={2}
      gap={8}
      size={64}
      initial={48}
    >
      {(cell) => (
        <button type="button" class="cell">
          {cell.item.label}
        </button>
      )}
    </VirtualGrid>
  );
}
