/** A query string as the plain record the project query takes (and keys its cache by). */
export function searchRecord(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search));
}
