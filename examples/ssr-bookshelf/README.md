# Bookshelf: a server-rendered Lumen sample

A multi-page book catalog with search, reviews, reading lists and accounts, backed by
`node:sqlite`. It shows Lumen's `server` and `static` route modes, form actions, cookie sessions,
islands and `<Suspense>` streaming.

**Status.** The data layer is done (TASK-46). The first pages run on `lumen dev` (TASK-24): home
(with the streamed recommendations), the book list and detail, sign-in/sign-out, about, the search
endpoint and the 404 page. The rest of the planned site below is TASK-36.

## Run it

Node 24 or later; `node:sqlite` is built in.

```sh
pnpm --filter @lumen-examples/ssr-bookshelf dev        # seeds if empty, then lumen dev on :5173
pnpm --filter @lumen-examples/ssr-bookshelf seed       # (re)creates data/bookshelf.db
pnpm --filter @lumen-examples/ssr-bookshelf test       # Vitest, in-memory databases
pnpm --filter @lumen-examples/ssr-bookshelf typecheck
```

`node src/server/seed.server.ts --if-empty` keeps an already seeded database; `dev` runs it first.
In dev, `LUMEN_SECRET` comes from `.env.development` (a development-only value).

Every seeded user has the password `bookshelf`. `reader@example.com` has reviews and a reading
list, so it gets personal recommendations.

| Env variable        | Default                   | Purpose                                                              |
| ------------------- | ------------------------- | -------------------------------------------------------------------- |
| `LUMEN_SECRET`      | (required)                | HMAC secret of the session cookie, read by Lumen's `signedCookie()`. |
| `BOOKSHELF_DB`      | `data/bookshelf.db` (cwd) | Database file. `data/` is gitignored.                                |
| `BOOKSHELF_SLOW_MS` | `1500`                    | Artificial delay of the recommendations, to make streaming visible.  |

## Data

The seed is deterministic: a fixed PRNG seed always produces the same catalog. Only password
salts are random. It creates:

- 12 genres;
- 60 authors with bios;
- 200 books with ISBN-13s, made-up titles and descriptions;
- 40 users and 600 reviews, rated 1 to 5;
- about 260 reading-list entries.

Activity ends on 2026-09-30, so the data does not depend on when you seed.

| Table          | Notes                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| `genres`       | `slug` is the public id.                                                             |
| `authors`      | `slug` is the public id.                                                             |
| `books`        | `isbn` is the public id; one genre each; `cover_hue` drives a generated cover.       |
| `book_authors` | Ordered authors per book (about 7% are co-written).                                  |
| `book_search`  | FTS5 index over title, author names and description, kept in sync by triggers.       |
| `users`        | Email is unique and case-insensitive; `password_hash` is scrypt with its parameters. |
| `sessions`     | SHA-256 of the session token, with the user and expiry. Deleting a row revokes it.   |
| `reviews`      | One per user and book, with `CHECK (rating BETWEEN 1 AND 5)`.                        |
| `book_ratings` | View: review count and average rating per book.                                      |
| `reading_list` | `(user, book)` with the time it was added.                                           |

Migrations live in `db.server.ts` and are tracked with `PRAGMA user_version`. File databases use
WAL and foreign keys.

## Modules

Server-only code lives in `src/server/*.server.ts`. The compiler rejects imports of it from
client code (LUM4003).

| Module               | Exports                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `db.server.ts`       | `openDatabase(file?)`, `getDatabase()` (shared), `migrate`, `statement` (cached), `transaction`    |
| `queries.server.ts`  | `queries()` / `createQueries(db)`: books, authors, genres, reviews, reading list and users (below) |
| `auth.server.ts`     | `auth()` / `createAuth(db)`, `requireUser(ctx?)`, `loginHref(url)`, `safeRedirectPath(next)`       |
| `password.server.ts` | `hashPassword`, `verifyPassword` (scrypt, `node:crypto`)                                           |
| `seed.server.ts`     | `seed(db)`, `generateCatalog()`, CLI                                                               |

The modules in `src/types.ts` and `src/lib/` have no server imports, so islands can use them too:

- `src/types.ts`: domain types, all plain serializable data.
- `src/lib/pagination.ts`: page math and `pageWindow()` for pagers.
- `src/lib/search-params.ts`: `?q=&genre=&sort=&page=` to and from `BookFilters`.
- `src/lib/validation.ts`: form validators for reviews, registration and login.

These are the queries:

- **Books:**
  - `listBooks({ q, genre, author, sort, page, pageSize })` returns a `Page<BookSummary>` with
    totals. `q` is an FTS5 prefix search ranked by bm25, with title matches above author matches
    above description matches. `sort` is one of `title`, `newest`, `oldest`, `rating` or
    `relevance`. `rating` uses a Bayesian average, and unreviewed books come last.
  - `getBook(isbn)` adds the description, the authors and a rating histogram.
- **Home page:**
  - `featuredBooks(limit)`.
  - `trendingBooks({ days, limit })`: the most reviewed books in the last 30 days of activity.
  - `recommendationsFor(userId | null, { delayMs, signal })`: async and deliberately slow.
- **Authors and genres:** `listAuthors({ q, page })`, `getAuthor(slug)`, `listGenres()` and
  `getGenre(slug)`.
- **Reviews:**
  - `listReviews(bookId, paging)`, `listUserReviews(userId, paging)`, `getReview(id)` and
    `getUserReview(userId, bookId)`.
  - `createReview`, `updateReview` and `deleteReview` return `{ ok, value }` or
    `{ ok: false, reason: "not-found" | "forbidden" | "conflict" }`. Only the author may edit or
    delete a review.
- **Reading list:** `addToReadingList`, `removeFromReadingList`, `isOnReadingList`,
  `readingListIds(userId, bookIds)` (the initial state of a page's toggles) and
  `readingList(userId, paging)`.
- **Users:** `getUserById(id)` and `getUserByEmail(email)`. Neither returns the password hash.

### Sessions

`login(cookies, userId)` creates a random 256-bit token. It stores the token's SHA-256 in
`sessions` and sets an HMAC-signed, HttpOnly, `SameSite=Lax` cookie (`bookshelf_session`) with
Lumen's `signedCookie()`. Logging in also revokes any previous session in the cookie.

`currentUser(cookies)` checks the signature, then the session row:

- An expired, revoked or forged session clears the cookie.
- Past half of its 30-day lifetime, a session is extended and the cookie is re-sent.

Because `currentUser` can write cookies, call it in the middleware, never inside `<Suspense>`
(LUM5004).

`logout`, `revokeSession` and `revokeUserSessions` end sessions server-side, even if the cookie
was copied.

`requireUser(ctx?)` returns `locals.user`, falling back to the cookie. With no user, it throws
`redirect("/login?next=…")`. Pages can call it without `ctx`.

## Planned site (TASK-36)

`src/middleware.ts` sets `ctx.locals.user = await auth().currentUser(ctx.cookies)`. The
`Locals.user` type is declared in `auth.server.ts`.

Most routes are `server`, because they show the signed-in user or read the query string. The
`static` routes are prerendered at build time and get the account menu from an island.

| Route                 | Mode   | Content                                                                                   |
| --------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/`                   | server | Featured and trending books; **`<Suspense>` streams `recommendationsFor(user)`**          |
| `/books`              | server | `listBooks(parseBookFilters(url().searchParams))`; genre and sort form; pager             |
| `/books/[isbn]`       | server | Book detail, rating histogram, paginated reviews, your review form (create, edit, delete) |
| `/authors`            | server | Paginated author index with a name filter                                                 |
| `/authors/[slug]`     | server | Bio, rating, and `listBooks({ author })`                                                  |
| `/genres`             | static | Genre index with book counts                                                              |
| `/genres/[slug]`      | static | `staticPaths()` from `listGenres()`; top-rated books, with a link to `/books?genre=`      |
| `/about`              | static | About the sample                                                                          |
| `/login`, `/register` | server | Forms with `action`s; `fail(400, { errors })` re-renders with field errors                |
| `/logout`             | server | `POST` endpoint: `auth().logout(ctx.cookies)`, then `redirect("/")`                       |
| `/reading-list`       | server | `requireUser()`; your list, plus the `toggle` named action used by every toggle           |
| `/profile`            | server | `requireUser()`; your reviews                                                             |
| `/api/search`         | server | `GET` endpoint: top 8 `listBooks({ q })` results, for the live search island              |
| `/api/me`             | server | `GET` endpoint: `{ user }` for the account menu on static pages                           |
| `_404`, `_error`      | n/a    | Error pages                                                                               |

Layouts:

- `(app)/_layout.stsx` holds the server routes. It sets `mode = "server"` and renders the header
  with the user from `locals()`.
- `(static)/_layout.stsx` holds the static routes. Its header renders `<AccountMenu client:idle>`.

### Form actions

All of these are named actions posted to `?/name`, with the Origin/CSRF check on.

- `/books/[isbn]?/createReview`, `?/updateReview` and `?/deleteReview`:
  1. `requireUser(ctx)`.
  2. `validateReview(await ctx.formData())`.
  3. Map the query result: `forbidden` becomes `error(403)`, `not-found` becomes `notFound()`,
     and `conflict` becomes `fail(409)`.
- `/reading-list?/toggle`: add or remove `bookId`, then return `{ onList }`.
- `/login`:
  1. `validateLogin`.
  2. `auth().authenticate`.
  3. `auth().login(ctx.cookies, user.id)`.
  4. `redirect(safeRedirectPath(next))`.
- `/register`:
  1. `auth().register(form)`.
  2. `login`.
  3. `redirect`.

### Islands

| Island              | Directive        | Behavior                                                                                                                                          |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchBox`         | `client:load`    | Debounced live suggestions from `/api/search`. Enter submits the plain `GET /books?q=` form.                                                      |
| `ReadingListToggle` | `client:visible` | A `<form method="post" action="/reading-list?/toggle">` enhanced with `submit()` and `submitting()`. Initial state comes from `readingListIds()`. |
| `StarRatingInput`   | `client:visible` | Accessible radio-group star picker inside the review form, with client hints from `validateReview`.                                               |
| `AccountMenu`       | `client:idle`    | Static pages only: fetches `/api/me` and shows sign-in or the user's name.                                                                        |

Without JavaScript, every island falls back to a plain link or form.
