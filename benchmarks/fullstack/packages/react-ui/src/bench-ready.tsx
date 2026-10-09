"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __benchReady?: number;
  }
}

/**
 * Sets `window.__benchReady = performance.now()` once the page has hydrated
 * (doc-4 §4). Render it last in the root layout: React runs effects in tree
 * order, so it fires after every interactive component of the initial
 * hydration has run its own effects.
 */
export function BenchReady() {
  useEffect(() => {
    // oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
    window.__benchReady ??= performance.now();
  }, []);
  return null;
}
