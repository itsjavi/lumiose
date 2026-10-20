This is a static Lumiose blog. Add a like button to each blog post page (`src/routes/blog/[slug]/page.stsx`), below the post body.

- Create it as `LikeButton`, exported from `src/components/LikeButton.stsx`, taking a `count` prop: the post's current number of likes (the new `likes` field in `src/lib/posts.ts`).
- It renders a single `<button>` whose text is `♥ <count>` (for example `♥ 12`) and that has `aria-pressed="false"`.
- Clicking it toggles a like: the first click shows one more like and sets `aria-pressed="true"`; clicking again goes back. No server call is needed.
- It is the only interactive part of the page: the rest stays static HTML, and its JavaScript should load when the browser is idle.

When you are done, `lumiose check` and `lumiose build` must succeed.
