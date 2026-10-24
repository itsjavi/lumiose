import { VirtualList, VirtualTable, type Virtualizer } from "@lumiose/ui/virtualizer";
import { signal } from "lumiose";

const PEOPLE = Array.from({ length: 1000 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Person ${i + 1}`,
}));
const RELEASES = Array.from({ length: 2000 }, (_, i) => ({
  id: `r${i + 1}`,
  version: `1.${Math.floor(i / 10)}.${i % 10}`,
  downloads: (i * 7919) % 10007,
}));

/** A row's own state, which a rebuilt row would lose. */
function Star(props: { name: string }) {
  const starred = signal(false);
  return (
    <button
      type="button"
      class="person"
      aria-pressed={starred()}
      onClick={() => starred.set(!starred())}
    >
      {props.name}
    </button>
  );
}

/**
 * VirtualTable in its own scroller and VirtualList on the window (TASK-565): the server renders
 * their first rows, the island takes them over. Renaming replaces every person with a new object
 * under the same id: the rows, and their stars, stay.
 */
export function VirtualComponents() {
  let scroller: HTMLDivElement | undefined;
  let list: Virtualizer | undefined;
  const people = signal(PEOPLE);
  const renamed = signal(0);
  return (
    <>
      <section>
        <h2 id="releases-heading">Releases</h2>
        <div
          ref={(el) => (scroller = el)}
          class="releases"
          role="region"
          aria-labelledby="releases-heading"
          tabindex={0}
        >
          <VirtualTable
            items={RELEASES}
            itemKey={(release) => release.id}
            size={32}
            scroller={() => scroller}
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
            rowProps={(release) => ({ "data-id": release.id })}
          >
            {(row) => (
              <>
                <td>{row.item.version}</td>
                <td>{row.item.downloads}</td>
              </>
            )}
          </VirtualTable>
        </div>
      </section>
      <section>
        <h2 id="people-heading">People</h2>
        <div class="actions">
          <button
            type="button"
            class="lu-button"
            onClick={() => list?.scrollToIndex(499, { align: "start" })}
          >
            Scroll to person 500
          </button>
          <button
            type="button"
            class="lu-button"
            onClick={() => {
              renamed.set(renamed() + 1);
              people.set(PEOPLE.map((p) => ({ ...p, name: `${p.name} (${renamed()})` })));
            }}
          >
            Rename
          </button>
        </div>
        <VirtualList
          class="people"
          aria-labelledby="people-heading"
          items={people()}
          itemKey={(person) => person.id}
          size={40}
          initial={20}
          virtualizer={(v) => (list = v)}
        >
          {(row) => <Star name={row.item.name} />}
        </VirtualList>
        <button type="button" class="lu-button">
          After the people
        </button>
      </section>
    </>
  );
}
