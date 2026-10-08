// The benchmark page's data: 1,000 deterministic rows whose text and attributes need escaping.
// Every framework renders the same structure from it (see README in RESULTS.md).

export interface Item {
  id: number;
  label: string;
  description: string;
  url: string;
  price: number;
  tags: string[];
  active: boolean;
}

export interface PageData {
  title: string;
  links: Array<{ href: string; text: string }>;
  items: Item[];
}

const WORDS = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
];
const TAGS = ["new", "sale", "<hot>", "R&D", '"quoted"', "it's", "eco", "pro"];

/** A small LCG, so every run (and framework) sees the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

export function createPageData(rows = 1000): PageData {
  const next = random(42);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const items: Item[] = [];
  for (let id = 1; id <= rows; id++) {
    const word = pick(WORDS);
    items.push({
      id,
      label: `${word} <${id}> & "${pick(WORDS)}" 'item'`,
      description: `Ships with <script>alert("${word}")</script> & a 50% discount for ${pick(WORDS)} > ${pick(WORDS)}.`,
      url: `/items/${id}?ref=${word}&sort="asc"`,
      price: Math.round(next() * 100_000) / 100,
      tags: [pick(TAGS), pick(TAGS), pick(TAGS)],
      active: next() > 0.5,
    });
  }
  return {
    title: "Catalog <beta> & friends",
    links: [
      { href: "/?tab=all&page=1", text: "All & everything" },
      { href: '/?tab="new"', text: "New <arrivals>" },
      { href: "/about", text: "About 'us'" },
    ],
    items,
  };
}

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
