This is a Lumen app. Unknown URLs currently get a bare default error page.

1. Add a root layout so every page, including error pages, is wrapped in `<div class="site">` with a `<header>` containing a link to `/` with the text "Home".
2. Add a custom not-found page: for any unknown URL (for example `/nope` or `/a/b/c`) the response has status 404, shows the site layout, an `<h1>` with the text "Page not found", and a paragraph with a link back to `/` with the text "Go to the home page".

When you are done, `lumen check` must pass.
