// Test fixtures: a seeded in-memory database and a fake cookie jar. Imported only by tests.

import type { Cookies } from "lumiose";
import { openDatabase, type DatabaseSync } from "./db.server.ts";
import type { ScryptParams } from "./password.server.ts";
import { seed } from "./seed.server.ts";

/** Cheap enough to hash 40 seeded users in a few milliseconds. */
export const TEST_SCRYPT: ScryptParams = { N: 1024, r: 8, p: 1 };

export async function seededDatabase(): Promise<DatabaseSync> {
  const db = openDatabase(":memory:");
  await seed(db, { scrypt: TEST_SCRYPT });
  return db;
}

/**
 * Wraps each test in a transaction that is rolled back, so tests can share one seeded database.
 * Call from `beforeEach`/`afterEach`.
 */
export function rollbackEach(db: () => DatabaseSync) {
  return {
    begin: () => db().exec("BEGIN"),
    rollback: () => db().exec("ROLLBACK"),
  };
}

export interface FakeCookies extends Cookies {
  /** Every `set`/`delete` call, in order (`value: null` for a delete). */
  writes: Array<{ name: string; value: string | null; maxAge: number | undefined }>;
}

export function fakeCookies(initial: Record<string, string> = {}): FakeCookies {
  const store = new Map(Object.entries(initial));
  const writes: FakeCookies["writes"] = [];
  return {
    writes,
    get: (name) => store.get(name),
    getAll: () => [...store].map(([name, value]) => ({ name, value })),
    set(name, value, options) {
      store.set(name, value);
      writes.push({ name, value, maxAge: options?.maxAge });
    },
    delete(name) {
      store.delete(name);
      writes.push({ name, value: null, maxAge: 0 });
    },
  };
}
