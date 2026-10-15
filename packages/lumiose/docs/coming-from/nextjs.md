# Coming from Next.js

> The Next.js App Router mapped to Lumiose: the same route file names, server components by default, `client:*` islands instead of `"use client"`, form actions instead of server actions, head components instead of metadata, and rendering modes instead of caching rules.

This page maps the Next.js App Router (Next.js 16) to Lumiose's current API. For components and
hooks, read [Coming from React](react.md) first; this page covers the framework.

## Mental model

**The files look the same.** Lumiose's routes follow the App Router names: a folder under
`src/routes` is a URL segment, and `page`, `layout`, `route`, `error` and `not-found` files give it
behavior, with `[slug]`, `[...slug]`, `[[...slug]]`, `(group)` and `_private` folders
([Routing](../concepts/routing.md)). The Next.js files Lumiose does not have (`loading`,
`template`, `default`, `global-error`, `@slot` and `(.)` folders) are errors
([LUM5002](../errors/LUM5002.md)), so they never silently do nothing.

**Components are server components by default.** On `static` and `server` routes every component
renders on the server, may be `async`, and ships no JavaScript. Instead of a `"use client"` file
boundary, the page that uses a component decides: `<LikeButton client:visible />` makes that one
instance an [island](../concepts/islands.md) that hydrates in the browser, and the same component
stays static elsewhere. Children passed to an island render on the server and stay there, as
server components passed to a client component do. An `spa` route hydrates its whole subtree and
navigates on the client.

**The rendering mode is explicit, per route.** Next.js decides between static and dynamic rendering
from what a page reads, and caching rules decide how long results live. In Lumiose a route says
`export const mode = "static" | "server" | "spa"` (or inherits it from a layout or the project).
`static` is the default: built once, served as files. A `static` page that reads the request fails
the build ([LUM5001](../errors/LUM5001.md)) instead of turning dynamic
([Rendering modes](../concepts/rendering-modes.md)).

**No RPC.** Server actions are functions the client calls. Lumiose has form actions: a page exports
`actions`, a `<form method="post" action="?/name">` posts to one and works without JavaScript, and
`submit()` posts it from an island. Other calls from the browser go to endpoints (`route.ts`)
([Data and actions](../concepts/data-and-actions.md)).

**Caching is per request and per page.** `fetchJSON()` and `query()` dedupe the same URL or key
within a request on the server, and cache it for the page in the browser (stale-while-revalidate).
There is no data cache shared across requests and no incremental regeneration: for fresh-but-cheap
pages, render on the `server` and send `cache-control` headers to a CDN.

## From Next.js to Lumiose

### Routes and files

| Next.js                                                            | Lumiose                                                                                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                                                             | `src/routes/`.                                                                                                                                              |
| `page.tsx`, `layout.tsx`, `route.ts`, `not-found.tsx`, `error.tsx` | The same names, as `.stsx` (with styles) or `.tsx`; `route.ts` for endpoints.                                                                               |
| `[slug]`, `[...slug]`, `[[...slug]]`, `(group)`, `_folder`         | The same, plus `[[slug]]` for one optional segment.                                                                                                         |
| `PageProps<"/blog/[slug]">`, `await params`                        | `PageProps<"/blog/[slug]">` and `LayoutProps<"/blog">` from `lumiose`; `params` is a plain object.                                                          |
| `searchParams` page prop                                           | `url().searchParams` on `server` routes; `searchParams()` from `lumiose/router` in islands and `spa` routes.                                                |
| Root `layout.tsx` with `<html>` and `<body>`                       | `src/document.stsx` owns `<html>`, `<head>` and `<body>` (optional); `src/routes/layout.stsx` wraps the pages.                                              |
| `loading.tsx`                                                      | `<Suspense fallback>` in the page or layout: on `server` routes, the content inside streams after the shell.                                                |
| `error.tsx`                                                        | `error.stsx`, a page rendered with `{ status, error }` inside its folder's layouts. For a retry in place, `<ErrorBoundary fallback={(error, reset) => …}>`. |
| `not-found.tsx`, `notFound()`                                      | `not-found.stsx` (the nearest wins), `notFound()`.                                                                                                          |
| `global-error.tsx`                                                 | The root `error.stsx`: when a layout itself fails, it renders without layouts.                                                                              |
| `generateStaticParams()`                                           | `staticPaths()`, returning `[{ params: { slug } }]`.                                                                                                        |
| Typed routes, `` `/blog/${slug}` `` in `<Link href>`               | `href("/blog/[slug]", { slug })`, type-checked against the routes.                                                                                          |

### Components and data

| Next.js                                                  | Lumiose                                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server components, `async` components                    | Every component on `static` and `server` routes. Async components also work in islands and `spa` routes, in the browser.                           |
| `"use client"`                                           | A `client:*` directive at the usage site: `client:load`, `client:idle`, `client:visible`, `client:media`; or an `spa` route.                       |
| `dynamic(() => import(…), { ssr: false })`               | `client:only`: rendered in the browser only.                                                                                                       |
| Serializable props of client components                  | The same rule for island props, which also accept `Date`, `Map`, `Set`, `URL` and `BigInt` ([LUM4002](../errors/LUM4002.md)).                      |
| `import "server-only"`                                   | `*.server.ts` modules or `src/server/`: importing them from browser code is [LUM4003](../errors/LUM4003.md).                                       |
| `fetch()` in a server component, `React.cache()`         | `await fetchJSON(url)` or `await query(key, fn)` in the component: one request per URL or key per request; same-origin URLs are served in-process. |
| `"use cache"`, `cacheLife`, `cacheTag`, `unstable_cache` | No cross-request data cache: the request cache above, `cache-control` headers for a CDN, or a cache of your own in a server module.                |
| `revalidateTag(tag)`, `updateTag(tag)`                   | In the browser, `invalidate(["tag"])` refetches the `query()` entries whose key starts with it.                                                    |
| `revalidatePath(path)`, `router.refresh()`               | `invalidate()`: re-runs the page's async components on `spa` routes, reloads `static` and `server` pages.                                          |
| `cookies()`, `headers()` (async)                         | `cookies()` and `request().headers` (synchronous), on `server` routes and in middleware, endpoints and actions.                                    |
| `after(fn)`                                              | `ctx.platform.waitUntil(promise)`.                                                                                                                 |
| `process.env.SECRET`, `NEXT_PUBLIC_*`                    | `env("SECRET")` in server code; `import.meta.env.PUBLIC_*` in browser code.                                                                        |

### Mutations

| Next.js                                         | Lumiose                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"use server"` and `<form action={createPost}>` | `export const actions = { create(ctx) {…} }` and `<form method="post" action="?/create">`, which works without JavaScript.                                |
| A server action called from a client component  | `submit(target, { action: "/posts?/create" })` from an island (a form, a submit event, `FormData` or a record), or an endpoint called with `fetchJSON()`. |
| `useActionState(action, initial)`               | `actionData<typeof actions>()`, or the result that `await submit(event)` resolves to.                                                                     |
| `useFormStatus()`                               | `isSubmitting()`, or `isSubmitting("create")` for one action.                                                                                             |
| `useOptimistic()`                               | `optimistic(source)` with `.update(fn, submit(event))`.                                                                                                   |
| `redirect()` in a server action                 | `redirect(to)` in the action: 303 after a POST.                                                                                                           |
| Returning validation errors from an action      | `return fail(400, { errors })`: the page re-renders with that status, and `actionData()` holds the errors.                                                |

### Server and head

| Next.js                                                           | Lumiose                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route handlers: `GET(request, { params })`, `NextResponse.json()` | `export const GET: Endpoint<"/api/posts/[id]"> = (ctx) => Response`, with `ctx.request`, `ctx.params`, `ctx.url`, `ctx.cookies`; `Response.json()`.                                                                                                                      |
| `middleware.ts` (`proxy.ts` in Next.js 16)                        | `src/middleware.ts`: `(ctx, next) => Response`. `NextResponse.next()` is `next()`; request data goes on `ctx.locals`.                                                                                                                                                    |
| `config.matcher`                                                  | A `middleware.ts` in the route folder it covers (`src/routes/dashboard/middleware.ts` for `/dashboard/:path*`); it runs after `src/middleware.ts`. `ctx.route`, the matched pattern, serves other checks.                                                                |
| `instrumentation-client.ts`                                       | `src/instrumentation.client.ts`: runs once per page load, before islands hydrate and the SPA starts, top-level `await` included; pages without JavaScript load only it ([Islands](../concepts/islands.md#concept)).                                                      |
| `instrumentation.ts`: `register()`, `onRequestError()`            | `src/instrumentation.server.ts` with the same exports: `register()` runs once per server instance, `onRequestError(error, info)` gets `{ request, route, params, phase, digest }`; `instrumentations` time each phase ([Server](../concepts/server.md#instrumentation)). |
| `metadata`, `generateMetadata()`                                  | `<Title>`, `<Meta>` and `<Head>` rendered by the page or layout; an async page awaits its data first. The deepest wins ([Head and document](../concepts/head.md)).                                                                                                       |
| `generateViewport()`                                              | `<Meta name="viewport" … />`, or the tag in `document.stsx`.                                                                                                                                                                                                             |
| `sitemap.ts`, `robots.ts`                                         | Endpoints: `sitemap.xml/route.ts`, `robots.txt/route.ts`, written at build time on `static` routes.                                                                                                                                                                      |
| `next/script`                                                     | `<Head><script src="…" async /></Head>`; under a strict CSP, see [Security](../concepts/security.md).                                                                                                                                                                    |
| `next/font`                                                       | `@font-face` in a `<style global>` block, with the font files in `public/`.                                                                                                                                                                                              |
| `next/image`                                                      | No image component: `import photo from "./photo.jpg"` gives the fingerprinted URL; write `<img>` with `width`, `height`, `loading="lazy"` and `srcset`. Vite plugins that resize images at build time work in `vite.config.ts`.                                          |
| `next.config`: `headers()`, `basePath`, `trailingSlash`, `i18n`   | `lumiose({ headers, trailingSlash, i18n })` and Vite's `base`, in `vite.config.ts`. Redirects go in middleware.                                                                                                                                                          |

### Navigation

| Next.js                                                              | Lumiose                                                                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next/link`                                                          | `<a href={href(…)}>`, or `<Link href prefetch>` from `lumiose/router`. MPA pages prefetch on hover by default; `prefetch="viewport"` matches Next.js.                |
| Client-side navigation between pages                                 | On `spa` routes, with persistent layouts. `static` and `server` pages load the next document, with optional View Transitions (`lumiose({ viewTransitions: true })`). |
| `useRouter().push(href)`, `.replace(href)`                           | `navigate(href)`, `navigate(href, { replace: true })` from `lumiose/router`.                                                                                         |
| `usePathname()`, `useSearchParams()`, `useParams()`                  | `url().pathname`, `searchParams()` (and `searchParams.set()`), `params()` from `lumiose/router`.                                                                     |
| `useSelectedLayoutSegment()`                                         | `route()`, the matched pattern: `route() === "/blog/[slug]"`.                                                                                                        |
| `redirect()`, `permanentRedirect()`, `forbidden()`, `unauthorized()` | `redirect(to)`, `redirect(to, 308)`, `error(403)`, `error(401)`.                                                                                                     |

### Rendering and deployment

| Next.js                                        | Lumiose                                                                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static rendering, `dynamic = "force-static"`   | `mode = "static"`, the default.                                                                                                                                       |
| Dynamic rendering, `dynamic = "force-dynamic"` | `export const mode = "server"`.                                                                                                                                       |
| Partial prerendering, Cache Components         | `server` + `<Suspense>`, or `static` + islands that call an endpoint ([Close to partial prerendering](../concepts/rendering-modes.md#close-to-partial-prerendering)). |
| `output: "export"`                             | Every route prerendered: the build writes no `dist/server`, and any static host serves `dist/client` ([Static hosts](../deploy/static.md)).                           |
| `output: "standalone"`, `next start`           | `dist/server/entry.js`, served by `@lumiose/adapter-node` (`createServer()`) or `lumiose preview`.                                                                    |
| Vercel, Netlify, Cloudflare (OpenNext)         | `lumiose({ adapter: vercel() })`, `netlify()` or `cloudflare()` ([Deploy](../deploy/README.md)).                                                                      |

## What has no equivalent

| Next.js                                                  | Instead                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel routes (`@slot`, `default.tsx`)                 | Render the parts as components of one layout or page; branch on `route()` or a search param for conditional areas.                                                                                      |
| Intercepting routes (`(.)photo`), route modals           | A `<dialog>` in an island, with the open item in `searchParams()`; or an `spa` route whose layout keeps the list mounted while the detail page renders.                                                 |
| ISR (`revalidate`), on-demand revalidation on the server | Rebuild `static` pages, or render on the `server` and set `cache-control: s-maxage=…, stale-while-revalidate=…` for a CDN.                                                                              |
| A prebuilt shell with per-request holes (PPR)            | The two patterns in [Close to partial prerendering](../concepts/rendering-modes.md#close-to-partial-prerendering).                                                                                      |
| `template.tsx`                                           | None: page state resets on every navigation, and `spa` layouts keep theirs by design.                                                                                                                   |
| Middleware rewrites                                      | None: redirect instead, or render the same component from both routes.                                                                                                                                  |
| `onRouterTransitionStart` in `instrumentation-client.ts` | This version has no client instrumentation hooks: `afterNavigate()` from `lumiose/router` in a layout observes navigations, and `window` `error` and `unhandledrejection` listeners catch what escapes. |
| Image optimization, `next/font` optimization             | None built in: see the `next/image` and `next/font` rows above.                                                                                                                                         |
| Generated images (`opengraph-image.tsx`, `icon.tsx`)     | Static files in `public/`, or an endpoint that returns the image.                                                                                                                                       |
| `forbidden.tsx`, `unauthorized.tsx`                      | `error(403)` and `error(401)` render `error.stsx`, which reads `status`.                                                                                                                                |
| Draft mode                                               | A `server` route that reads a preview cookie.                                                                                                                                                           |
| A custom server running `next dev`                       | This version has no dev handler for custom servers: develop with `lumiose dev`, and run your server against the build.                                                                                  |
| React component libraries                                | No React interop: native elements, web components or framework-agnostic libraries (see [Coming from React](react.md)).                                                                                  |

## Example

A blog post in Next.js: a server component, a streamed part, a client component and a server
action.

```tsx
// app/articles/[slug]/page.tsx
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { addComment, getComments, getPost } from "@/lib/posts";
import { Reactions } from "@/components/reactions"; // "use client" inside

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">) {
  const post = await getPost((await params).slug);
  return { title: post?.title };
}

export default async function Article({ params }: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  async function comment(formData: FormData) {
    "use server";
    await addComment(slug, String(formData.get("text") ?? ""));
    redirect(`/articles/${slug}`);
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <Reactions initial={post.likes} />
      <Suspense fallback={<p>Loading comments…</p>}>
        <Comments slug={slug} />
      </Suspense>
      <form action={comment}>
        <textarea name="text" />
        <button>Comment</button>
      </form>
    </article>
  );
}

async function Comments({ slug }: { slug: string }) {
  const comments = await getComments(slug);
  return (
    <ul>
      {comments.map((c) => (
        <li key={c.id}>{c.text}</li>
      ))}
    </ul>
  );
}
```

The same page in Lumiose. The data module stays on the server:

```ts check file=lib/articles.server.ts
// src/lib/articles.server.ts: a database in a real app
interface Comment {
  id: number;
  text: string;
}

const articles = new Map([
  ["hello", { title: "Hello", body: "The first post.", likes: 3, comments: [] as Comment[] }],
]);

export async function getArticle(slug: string) {
  return articles.get(slug);
}

export async function getComments(slug: string) {
  await new Promise((resolve) => setTimeout(resolve, 300)); // a slow query
  return articles.get(slug)?.comments ?? [];
}

export async function addComment(slug: string, text: string) {
  articles.get(slug)?.comments.push({ id: Date.now(), text });
}
```

The interactive part has no directive in its file:

```tsx check file=components/Reactions.tsx
// src/components/Reactions.tsx
import { signal } from "lumiose";

export function Reactions(props: { initial: number }) {
  const likes = signal(props.initial);
  return <button onClick={() => likes.update((n) => n + 1)}>Like ({likes()})</button>;
}
```

The page renders on the server per request, sends its shell (title, article, form) at once and
streams the comments in. `client:visible` hydrates the button when it scrolls into view. The form
posts to the `comment` action and works without JavaScript:

```stsx check file=routes/articles/[slug]/page.stsx
// src/routes/articles/[slug]/page.stsx
import { Suspense, Title, href, notFound, redirect, type ActionContext, type PageProps } from "lumiose";
import { Reactions } from "../../../components/Reactions.tsx";
import { addComment, getArticle, getComments } from "../../../lib/articles.server.ts";

export const mode = "server";

export const actions = {
  async comment(ctx: ActionContext<"/articles/[slug]">) {
    const text = String((await ctx.formData()).get("text") ?? "").trim();
    if (text !== "") await addComment(ctx.params.slug, text);
    redirect(href("/articles/[slug]", { slug: ctx.params.slug }));
  },
};

async function Comments(props: { slug: string }) {
  const comments = await getComments(props.slug);
  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>{comment.text}</li>
      ))}
    </ul>
  );
}

export default async function Article({ params }: PageProps<"/articles/[slug]">) {
  const article = (await getArticle(params.slug)) ?? notFound();
  return (
    <article>
      <Title>{article.title}</Title>
      <h1>{article.title}</h1>
      <p>{article.body}</p>
      <Reactions client:visible initial={article.likes} />
      <Suspense fallback={<p>Loading comments…</p>}>
        <Comments slug={params.slug} />
      </Suspense>
      <form method="post" action="?/comment">
        <textarea name="text" />
        <button>Comment</button>
      </form>
    </article>
  );
}
```

A static page per slug, where Next.js uses `generateStaticParams()` and `generateMetadata()`.
`static` is the default mode, so the page needs no `mode` export:

```tsx check file=routes/handbook/[slug]/page.tsx
// src/routes/handbook/[slug]/page.tsx: built once per slug, served as files
import { Meta, Title, notFound, type PageProps } from "lumiose";

const chapters = new Map([
  ["intro", { title: "Introduction", summary: "Why the handbook exists." }],
  ["setup", { title: "Setup", summary: "Install and configure the tools." }],
]);

async function getChapter(slug: string) {
  return chapters.get(slug); // a CMS or the file system in a real site
}

export function staticPaths() {
  return [...chapters.keys()].map((slug) => ({ params: { slug } }));
}

export default async function Chapter({ params }: PageProps<"/handbook/[slug]">) {
  const chapter = (await getChapter(params.slug)) ?? notFound();
  return (
    <main>
      <Title>{chapter.title}</Title>
      <Meta name="description" content={chapter.summary} />
      <h1>{chapter.title}</h1>
    </main>
  );
}
```

`app/sitemap.ts` becomes an endpoint, written to `dist/client/sitemap.xml` at build time:

```ts check file=routes/sitemap.xml/route.ts
// src/routes/sitemap.xml/route.ts
import { href, type Endpoint } from "lumiose";

const site = "https://example.com";

export const GET: Endpoint<"/sitemap.xml"> = () => {
  const urls = ["intro", "setup"].map(
    (slug) => `<url><loc>${site}${href("/handbook/[slug]", { slug })}</loc></url>`,
  );
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`,
    { headers: { "content-type": "application/xml" } },
  );
};
```

`middleware.ts` (`proxy.ts`) becomes `src/middleware.ts` for what runs on every request, and a
`middleware.ts` in a route folder for what a `matcher` scoped:

```ts check
// src/middleware.ts
import type { Middleware } from "lumiose";

const middleware: Middleware = async (ctx, next) => {
  const response = await next();
  response.headers.set("x-frame-options", "DENY");
  return response;
};

export default middleware;
```

```ts check file=routes/dashboard/middleware.ts
// src/routes/dashboard/middleware.ts: matcher "/dashboard/:path*", actions and endpoints included
import type { Middleware } from "lumiose";

const requireSession: Middleware<"/dashboard"> = (ctx, next) =>
  ctx.cookies.get("session") === undefined
    ? Response.redirect(new URL("/login", ctx.url), 307)
    : next();

export default requireSession;
```

## Common mistakes

- **`"use client"` at the top of a file.** It does nothing: the component still renders on the
  server only. Add a `client:*` directive where the page uses it.
- **Reading cookies or `searchParams` on a `static` page.** Next.js would switch the page to
  dynamic rendering; Lumiose stops the build with [LUM5001](../errors/LUM5001.md). Set
  `export const mode = "server"`.
- **Guarding a `static` page in middleware.** Prerendered pages are files in production, served
  without running middleware (it runs for them at build time; a folder middleware that covers
  them is [LUM5008](../errors/LUM5008.md)). Pages behind a sign-in are `server` or `spa` routes.
- **`loading.tsx`, `@modal` or `(.)photo`.** They are [LUM5002](../errors/LUM5002.md) errors. Use
  `<Suspense>`, components in the layout, and a dialog or an `spa` route.
- **`export const metadata`.** Nothing reads it. Render `<Title>` and `<Meta>`.
- **`<html>` and `<body>` in the root layout.** They belong in `src/document.stsx`; a layout
  renders inside `<body>`.
- **Importing a server action into an island.** There are no server functions: importing a
  `*.server.ts` module from browser code is [LUM4003](../errors/LUM4003.md). Post to a form action
  with `submit()`, or call an endpoint.
- **Expecting `fetch` results to be cached across requests.** The cache lives for one request on
  the server. Cache with HTTP headers, or keep the page `static`.
- **`await params`.** It works, but `params` is a plain object; read `params.slug` directly.
- **`NEXT_PUBLIC_` variables.** Browser code sees `import.meta.env.PUBLIC_*` only.

## Related

- [Routing](../concepts/routing.md): file routes, layouts, params, error pages and typed `href()`.
- [Islands](../concepts/islands.md): `client:*` directives, serializable props and slots.
- [Rendering modes](../concepts/rendering-modes.md): `static`, `server` and `spa` routes, streaming and the build.
- [Data and actions](../concepts/data-and-actions.md): endpoints, form actions, `submit()` and `invalidate()`.
- [Async components](../concepts/async.md): server and client async components and the request cache.
- [Head and document](../concepts/head.md): `<Title>`, `<Meta>`, `<Head>` and `document.stsx`.
- [Server](../concepts/server.md): middleware, cookies, env and redirects.
- [Deploy](../deploy/README.md): Node, Docker, Vercel, Netlify, Cloudflare and static hosts.
- [Coming from React](react.md): hooks, components and JSX.
