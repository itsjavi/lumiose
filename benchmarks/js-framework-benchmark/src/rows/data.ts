// Data of scripts/rows-ab.ts (TASK-555): 10 rows of 8 cards shaped like a virtual grid's visible
// window, whose row entries are re-derived from the items (a new object per row) on every change.
export interface Item {
  id: string;
  nid: string;
  dexNum: string;
  type1: string;
  type2: string | null;
  speciesName: string;
  formName?: string;
}

/** A row of the visible window: its key, its position and its cards. */
export interface Entry {
  key: string;
  index: number;
  row: Item[];
}

export const ROWS = 10;
export const COLUMNS = 8;
const TYPES = ["grass", "fire", "water", "bug", "normal", "poison", "electric", "ground", "fairy", "fighting"]; // prettier-ignore
let nextId = 1;

/** Items with new ids. */
export function makeItems(count = ROWS * COLUMNS): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const n = nextId++;
    items.push({
      id: `p${n}`,
      nid: `${String(n).padStart(4, "0")}-00-000-0`,
      dexNum: String(n),
      type1: TYPES[n % TYPES.length]!,
      type2: n % 3 === 0 ? TYPES[(n + 3) % TYPES.length]! : null,
      speciesName: `Species ${n}`,
      formName: n % 5 === 0 ? `Form ${n}` : undefined,
    });
  }
  return items;
}

/** New row entries for `items`, keyed by their position and their cards' ids. */
export function entries(items: Item[]): Entry[] {
  const result: Entry[] = [];
  for (let r = 0; r * COLUMNS < items.length; r++) {
    const row = items.slice(r * COLUMNS, (r + 1) * COLUMNS);
    result.push({ key: `${r}:${row.map((p) => p.id).join("|")}`, index: r, row });
  }
  return result;
}

/** New item objects with the same ids and fields, as a refetch returns. */
export const copies = (items: Item[]): Item[] => items.map((p) => ({ ...p }));

// A 1x1 GIF, distinct per card through the fragment (which a data URL's fetch ignores), so the page
// loads no files.
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
export const imgUrl = (nid: string): string => `${GIF}#${nid}`;
export const pad = (n: string): string => n.padStart(4, "0");
