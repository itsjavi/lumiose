import { createVirtualizer } from "@lumiose/ui/virtualizer";

const ROW = 32;
const RELEASES = Array.from({ length: 2000 }, (_, i) => ({
  id: `r${i + 1}`,
  version: `1.${Math.floor(i / 10)}.${i % 10}`,
  downloads: (i * 7919) % 10007,
}));

/**
 * A table of 2,000 releases in its own scroller (TASK-565): a sticky header, spacer rows for the
 * rows not rendered, `aria-rowcount` on the table and `aria-rowindex` on every row. The server
 * renders the first 15 rows.
 */
export function VirtualizerTable() {
  let scroller: HTMLDivElement | undefined;
  const table = createVirtualizer({
    count: RELEASES.length,
    size: ROW,
    scroller: () => scroller,
    initial: 15,
  });
  return (
    <section>
      <h2 id="releases-heading">Releases</h2>
      <div
        ref={(el) => (scroller = el)}
        class="releases"
        role="region"
        aria-labelledby="releases-heading"
        tabindex={0}
      >
        <table aria-rowcount={RELEASES.length + 1}>
          <thead>
            <tr aria-rowindex={1}>
              <th scope="col">Version</th>
              <th scope="col">Downloads</th>
            </tr>
          </thead>
          <tbody ref={table.container}>
            {table.before() > 0 ? (
              <tr aria-hidden="true" class="spacer">
                <td colspan={2} style={{ height: `${table.before()}px` }} />
              </tr>
            ) : null}
            {RELEASES.slice(table.range().start, table.range().end).map((release, offset) => (
              <tr key={release.id} aria-rowindex={table.range().start + offset + 2}>
                <td>{release.version}</td>
                <td>{release.downloads}</td>
              </tr>
            ))}
            {table.after() > 0 ? (
              <tr aria-hidden="true" class="spacer">
                <td colspan={2} style={{ height: `${table.after()}px` }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
