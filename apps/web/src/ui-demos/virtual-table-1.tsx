// Generated from packages/ui/docs/virtual-table.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { VirtualTable } from "@lumiose/ui";

const RELEASES = Array.from({ length: 2000 }, (_, i) => ({
  id: `r${i + 1}`,
  version: `1.${Math.floor(i / 10)}.${i % 10}`,
  downloads: (i * 7919) % 10007,
}));

export function ReleaseTable() {
  let box: HTMLDivElement | undefined;
  return (
    <div
      ref={(el) => (box = el)}
      role="region"
      aria-label="Releases"
      tabindex={0}
      style={{ "inline-size": "100%", "max-block-size": "20rem", overflow: "auto" }}
    >
      <VirtualTable
        style={{ "border-collapse": "collapse" }}
        items={RELEASES}
        itemKey={(release) => release.id}
        size={32}
        scroller={() => box}
        initial={15}
        colSpan={2}
        head={
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col">Version</th>
              <th scope="col">Downloads</th>
            </tr>
          </thead>
        }
        rowProps={() => ({ style: "block-size: 32px" })}
        empty={
          <tr>
            <td colspan={2}>No releases yet.</td>
          </tr>
        }
      >
        {(row) => (
          <>
            <td>{row.item.version}</td>
            <td>{row.item.downloads}</td>
          </>
        )}
      </VirtualTable>
    </div>
  );
}
