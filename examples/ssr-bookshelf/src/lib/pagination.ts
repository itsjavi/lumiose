// Offset pagination math, shared by server queries and page links. No server imports.

import type { PageInfo } from "../types.ts";

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

/** Normalizes a requested page and size: page >= 1, 1 <= size <= MAX_PAGE_SIZE, integers. */
export function normalizePaging(
  page: number | undefined,
  pageSize: number | undefined,
  defaultSize = DEFAULT_PAGE_SIZE,
): { page: number; pageSize: number; offset: number } {
  const size = clampInt(pageSize ?? defaultSize, 1, MAX_PAGE_SIZE, defaultSize);
  const current = clampInt(page ?? 1, 1, Number.MAX_SAFE_INTEGER, 1);
  return { page: current, pageSize: size, offset: (current - 1) * size };
}

export function pageInfo(total: number, page: number, pageSize: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    pageCount,
    hasPrevious: page > 1,
    hasNext: page < pageCount,
  };
}

/**
 * Page numbers to render in a pager: always the first and last page and a window around the
 * current one, with `null` marking each gap (`1 … 4 5 [6] 7 8 … 20`).
 */
export function pageWindow(current: number, pageCount: number, radius = 2): Array<number | null> {
  const pages: Array<number | null> = [];
  let previous = 0;
  for (let page = 1; page <= pageCount; page++) {
    const near = Math.abs(page - current) <= radius;
    if (page !== 1 && page !== pageCount && !near) continue;
    if (page - previous > 1) pages.push(null);
    pages.push(page);
    previous = page;
  }
  return pages;
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
