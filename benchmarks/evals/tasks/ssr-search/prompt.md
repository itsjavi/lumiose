This is a Lumiose app rendered on the server. Add a search page at `/search`.

- It has a search form that submits with GET to `/search`, with a text input named `q` that shows the current query.
- `/search?q=tea` lists the products returned by `searchProducts(q)` from `src/server/products.server.ts`, as a `<ul class="results">` with one `<li>` per product whose text is `<name> — <price>` with the price formatted with two decimals and a euro sign, e.g. `Green tea — 4.50 €`.
- With a query that matches nothing, show a paragraph `No products match “<q>”.` instead of the list.
- Without a query (or an empty one), show the paragraph `Type something to search.` and no list.
- Load the data the Lumiose way for server pages (no client-side fetching, no JavaScript shipped for this page).

When you are done, `lumiose check` must pass.
