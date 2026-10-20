import type { Endpoint } from "lumiose";
import { getStock } from "../../../../server/stock.server.ts";

export const GET: Endpoint<"/api/stock/[sku]"> = ({ params }) => {
  const stock = getStock(params.sku);
  if (stock === undefined) return Response.json({ error: "unknown sku" }, { status: 404 });
  return Response.json({ sku: params.sku, stock });
};
