// A demo store: entries live in memory and are lost when the server restarts. Swap it for a
// database (node:sqlite, Postgres, …). `*.server.ts` modules never reach the browser:
// `lumen dev` and `lumen build` fail if client code imports one (LUM4003).

export interface Entry {
  id: number;
  name: string;
  message: string;
  createdAt: string;
}

const entries: Entry[] = [];

/** Newest first. */
export function listEntries(): Entry[] {
  return entries.toReversed();
}

export function addEntry(name: string, message: string): Entry {
  const entry = { id: entries.length + 1, name, message, createdAt: new Date().toISOString() };
  entries.push(entry);
  return entry;
}
