import { createVirtualizer } from "@lumiose/ui/virtualizer";

const GAP = 16;
const WORDS = "light, signal, island, render, stream, keyed, window, measure".split(", ");
const CARDS = Array.from({ length: 600 }, (_, i) => ({
  id: `c${i + 1}`,
  title: `Card ${i + 1}`,
  // Bodies of one to four lines, so the rows' heights differ and are measured.
  body: Array.from({ length: 4 + (i % 4) * 6 }, (_word, w) => WORDS[(i + w) % WORDS.length]).join(
    " ",
  ),
}));

/**
 * A window-scrolled grid of 600 cards (TASK-565): as many columns of at least 12rem as the width
 * fits, rows positioned from `start(row)` and measured as they render (one observer). The rows are
 * presentational: the cards are the list's items, with their place among all 600.
 */
export function VirtualizerGrid() {
  const grid = createVirtualizer({
    count: CARDS.length,
    columns: { minWidth: 192 },
    gap: GAP,
    size: 120,
    overscan: 2,
  });
  const cards = (row: number) => CARDS.slice(row * grid.columns(), (row + 1) * grid.columns());
  return (
    <div
      ref={grid.container}
      role="list"
      aria-label="Cards"
      class="cards"
      style={{ position: "relative", height: `${grid.total()}px` }}
    >
      {grid.rows().map((row) => (
        <div
          key={row}
          role="none"
          data-row={row}
          attach={[grid.measure]}
          class="card-row"
          style={{
            position: "absolute",
            inset: "0 0 auto",
            display: "grid",
            gap: `${GAP}px`,
            "grid-template-columns": `repeat(${grid.columns()}, minmax(0, 1fr))`,
            transform: `translateY(${grid.start(row)}px)`,
          }}
        >
          {cards(row).map((card, i) => (
            <div
              key={card.id}
              role="listitem"
              class="card"
              aria-setsize={CARDS.length}
              aria-posinset={row * grid.columns() + i + 1}
            >
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
