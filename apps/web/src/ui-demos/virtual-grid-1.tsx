// Generated from packages/ui/docs/virtual-grid.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { VirtualGrid } from "@lumiose/ui";

const ENTRIES = Array.from({ length: 1200 }, (_, i) => ({ id: `e${i + 1}`, label: `#${i + 1}` }));

export function EntryGrid() {
  let box: HTMLDivElement | undefined;
  return (
    <div
      ref={(el) => (box = el)}
      role="region"
      aria-label="Entries"
      tabindex={0}
      style={{ "inline-size": "100%", "max-block-size": "18rem", overflow: "auto" }}
    >
      <VirtualGrid
        aria-label="Entries"
        style={{
          margin: "0",
          padding: "0",
          "list-style": "none",
          display: "grid",
          "grid-template-columns": "repeat(auto-fill, minmax(96px, 1fr))",
          gap: "8px",
        }}
        items={ENTRIES}
        itemKey={(entry) => entry.id}
        minItemWidth={96}
        gap={8}
        size={64}
        initial={48}
        scroller={() => box}
      >
        {(cell) => (
          <button type="button" style={{ "inline-size": "100%", "block-size": "64px" }}>
            {cell.item.label}
          </button>
        )}
      </VirtualGrid>
    </div>
  );
}
