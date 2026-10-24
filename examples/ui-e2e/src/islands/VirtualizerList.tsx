import { createVirtualizer } from "@lumiose/ui/virtualizer";
import { signal } from "lumiose";

const ROW = 40;
const PEOPLE = Array.from({ length: 1000 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Person ${i + 1}`,
}));

/**
 * A window-scrolled list of 1,000 people (TASK-565). The server renders the first 20 in flow, with
 * the rest of the list's height as a padding; once mounted, the rows are placed from `start(row)`
 * and the focused one stays rendered. Keyed by the record's id.
 */
export function VirtualizerList() {
  const people = signal(PEOPLE);
  const list = createVirtualizer({
    count: () => people().length,
    size: ROW,
    initial: 20,
    keepFocused: true,
  });
  return (
    <section>
      <h2 id="people-heading">People</h2>
      <div class="actions">
        <button
          type="button"
          class="lu-button"
          onClick={() => list.scrollToIndex(499, { align: "start" })}
        >
          Scroll to person 500
        </button>
        <button type="button" class="lu-button" onClick={() => people.set(people().toReversed())}>
          Reverse
        </button>
      </div>
      <ul
        ref={list.container}
        aria-labelledby="people-heading"
        data-mounted={list.mounted() ? "" : undefined}
        class="people"
        style={
          list.mounted()
            ? { position: "relative", height: `${list.total()}px` }
            : { "padding-block-end": `${list.after()}px` }
        }
      >
        {list.items().map((i) => (
          <li
            key={people()[i]!.id}
            data-row={i}
            aria-setsize={people().length}
            aria-posinset={i + 1}
            style={
              list.mounted()
                ? {
                    position: "absolute",
                    inset: "0 0 auto",
                    transform: `translateY(${list.start(i)}px)`,
                  }
                : undefined
            }
          >
            <button type="button" class="person">
              {people()[i]!.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" class="lu-button">
        After the people
      </button>
    </section>
  );
}
