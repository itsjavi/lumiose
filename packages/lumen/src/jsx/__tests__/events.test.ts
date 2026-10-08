// The `delegatedEvents` table (TASK-43). Its type-level checks (lowercasing, lib.dom coverage) live in
// `.fixtures/events.tsx`; this checks the runtime object the compiler and language server mirror.
import { describe, expect, it } from "vitest";
import { delegatedEvents } from "../events.ts";

describe("delegatedEvents", () => {
  const entries = Object.entries(delegatedEvents);

  it("maps camelCase suffixes to their lowercased DOM event names", () => {
    for (const [suffix, type] of entries) {
      expect(suffix).toMatch(/^(?:[A-Z][a-z]*)+$/);
      expect(type).toBe(suffix.toLowerCase());
    }
  });

  it("has one entry per DOM event", () => {
    expect(new Set(entries.map(([, type]) => type)).size).toBe(entries.length);
  });
});
