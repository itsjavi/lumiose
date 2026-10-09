This is a Lumen app rendered on the server. Add a JSON API endpoint `GET /api/books` over the books in `src/lib/books.ts`.

- `q` (optional): keep only books whose title or author contains `q`, case-insensitively.
- `limit` (optional, default 10): the maximum number of books returned. It must be an integer from 1 to 50; anything else gets a `400` response with the JSON body `{ "error": "limit must be an integer from 1 to 50" }`.
- The response is a JSON array of the matching books (all their fields), sorted by `year` ascending, then by `id`.

Use Lumen's typed endpoint conventions. When you are done, `lumen check` must pass.
