This is a Lumiose app rendered on the server. Product pages (`/products/<sku>`) show a `StockBadge` island with a "Refresh" button, but the app fails to build and `lumiose check` reports an error: the island imports server-only code (`src/server/stock.server.ts`).

Fix it, keeping the stock module server-only:

- Add a JSON endpoint `GET /api/stock/<sku>` that returns `{ "sku": "<sku>", "stock": <units> }`, or status 404 with `{ "error": "unknown sku" }` for an unknown SKU.
- The product page must still show `In stock: <units>` in its server-rendered HTML.
- The island's "Refresh" button must load the current stock from that endpoint.

When you are done, `lumiose check` and `lumiose build` must succeed.
