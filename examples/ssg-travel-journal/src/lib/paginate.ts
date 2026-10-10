// Pagination of the journal: page 1 is `/`, the others `/page/2`, `/page/3`, …

import { href } from "lumiose";

export interface Page<T> {
  /** 1-based. */
  number: number;
  /** Total number of pages (at least 1). */
  count: number;
  items: readonly T[];
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** Page `number` of `items`, or `undefined` when it does not exist. */
export function paginate<T>(
  items: readonly T[],
  size: number,
  number: number,
): Page<T> | undefined {
  const count = pageCount(items.length, size);
  if (!Number.isInteger(number) || number < 1 || number > count) return undefined;
  return { number, count, items: items.slice((number - 1) * size, number * size) };
}

/** The URL of journal page `number`. */
export function pageHref(number: number): string {
  return number === 1 ? href("/") : href("/page/[page]", { page: String(number) });
}
