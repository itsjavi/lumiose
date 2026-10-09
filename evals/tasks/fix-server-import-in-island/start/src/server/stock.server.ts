// Warehouse stock (server-only: in a real app this reads the inventory database).
const stock = new Map<string, number>([
  ["TEA-1", 7],
  ["TEA-2", 0],
  ["MUG-1", 42],
]);

export function hasProduct(sku: string): boolean {
  return stock.has(sku);
}

/** Units in stock, or undefined for an unknown SKU. */
export function getStock(sku: string): number | undefined {
  return stock.get(sku);
}
