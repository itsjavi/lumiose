// Generated from packages/ui/docs/virtual-list.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { VirtualList, type Virtualizer } from "@lumiose/ui";

const PEOPLE = Array.from({ length: 1000 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Person ${i + 1}`,
}));

export function PeopleList() {
  let box: HTMLDivElement | undefined;
  let list: Virtualizer | undefined;
  return (
    <>
      <button type="button" onClick={() => list?.scrollToIndex(499, { align: "start" })}>
        Go to person 500
      </button>
      <div
        ref={(el) => (box = el)}
        role="region"
        aria-label="People"
        tabindex={0}
        style={{ "inline-size": "100%", "max-block-size": "16rem", overflow: "auto" }}
      >
        <VirtualList
          aria-label="People"
          style={{ margin: "0", padding: "0", "list-style": "none" }}
          items={PEOPLE}
          itemKey={(person) => person.id}
          size={40}
          initial={20}
          scroller={() => box}
          virtualizer={(v) => (list = v)}
        >
          {(row) => (
            <span>
              {row.index + 1}. {row.item.name}
            </span>
          )}
        </VirtualList>
      </div>
    </>
  );
}
