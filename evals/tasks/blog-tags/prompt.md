This is a static Lumen blog (`lumen build` prerenders every page). Posts in `src/lib/posts.ts` now have `tags`.

Add a page per tag at `/tags/<tag>` (for example `/tags/lumen`):

- Its `<h1>` is `Posts tagged “<tag>”` (with those curly quotes), followed by a list of the posts with that tag, newest first, each a link to the post (`/blog/<slug>`) whose text is the post title.
- `lumen build` must prerender one page for every tag used by the posts.
- A tag that no post uses must render the site's 404 page with status 404.

When you are done, `lumen check` and `lumen build` must succeed.
