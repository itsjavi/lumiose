import { VirtualGrid } from "@lumiose/ui/virtualizer";

const WORDS = "light, signal, island, render, stream, keyed, window, measure".split(", ");
const CARDS = Array.from({ length: 600 }, (_, i) => ({
  id: `c${i + 1}`,
  title: `Card ${i + 1}`,
  // Bodies of one to four lines, so the cells' heights differ and are measured.
  body: Array.from({ length: 4 + (i % 4) * 6 }, (_word, w) => WORDS[(i + w) % WORDS.length]).join(
    " ",
  ),
}));

/** A measured VirtualGrid (TASK-565): each row is as tall as its tallest card. Browser only. */
export function VirtualCards() {
  return (
    <VirtualGrid
      class="cards"
      aria-label="Cards"
      items={CARDS}
      itemKey={(card) => card.id}
      minItemWidth={192}
      gap={16}
      size={120}
      measure
      overscan={2}
    >
      {(cell) => (
        <article class="card" aria-label={cell.item.title}>
          <h3>{cell.item.title}</h3>
          <p>{cell.item.body}</p>
        </article>
      )}
    </VirtualGrid>
  );
}
