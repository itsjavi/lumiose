// The product catalogue (server-only).
export interface Product {
  sku: string;
  name: string;
  price: number;
}

const products: Product[] = [
  { sku: "TEA-1", name: "Green tea", price: 4.5 },
  { sku: "TEA-2", name: "Black tea", price: 3.9 },
  { sku: "COF-1", name: "Espresso beans", price: 9.0 },
  { sku: "COF-2", name: "Decaf coffee", price: 8.25 },
  { sku: "MUG-1", name: "Tea mug", price: 12.0 },
];

/** Products whose name contains `query`, case-insensitively, in catalogue order. */
export async function searchProducts(query: string): Promise<Product[]> {
  await new Promise((resolve) => setTimeout(resolve, 20));
  const q = query.toLowerCase();
  return products.filter((product) => product.name.toLowerCase().includes(q));
}
