# Content from Sanity

> Read Sanity content in async components and prerender it, preview drafts on server-rendered routes behind a secret, and rebuild the static pages when editors publish.

[Sanity](https://www.sanity.io) keeps the content and its editing studio; Lumiose reads it with
`@sanity/client`, which runs in server code. Published content is read at build time, so the
pages are static files; drafts are read per request on a separate, server-rendered preview route.

| File                                          | Role                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `src/server/sanity.server.ts`                 | The Sanity clients, the queries and the preview cookie. Server-only.      |
| `src/components/Story.stsx`                   | A story, rendered the same way for published content and drafts.          |
| `src/routes/stories/page.stsx`                | The list of stories, prerendered.                                         |
| `src/routes/stories/[slug]/page.stsx`         | One page per published story, prerendered with `staticPaths()`.           |
| `src/routes/api/preview/route.ts`             | Turns preview on (a signed cookie) when the secret matches.               |
| `src/routes/preview/stories/[slug]/page.stsx` | The draft of a story, rendered per request for previewers.                |
| `src/routes/api/sanity/webhook/route.ts`      | Optional: Sanity's publish webhook, verified, then the host's build hook. |

> **Status:** written against Sanity's documentation and the `@sanity/client` 8 and
> `@sanity/webhook` 4 packages (their types check every example on this page); not run against a
> Sanity project.

## Setup

```sh
pnpm add @sanity/client
pnpm add @sanity/webhook   # only for the webhook endpoint
```

| Variable                | Use                                                                            |
| ----------------------- | ------------------------------------------------------------------------------ |
| `SANITY_PROJECT_ID`     | The project id, from the Sanity dashboard.                                     |
| `SANITY_DATASET`        | Usually `production`.                                                          |
| `SANITY_READ_TOKEN`     | A token with read access to drafts, for previews only. Never in browser code.  |
| `SANITY_PREVIEW_SECRET` | A random string the studio's preview link carries (`openssl rand -base64 32`). |
| `LUMIOSE_SECRET`        | Signs the preview cookie ([Server](../concepts/server.md)).                    |

The pages here are `static` (the project default) except the preview route and the endpoints,
which say `export const mode = "server"`. A site with no server at all can skip previews and the
webhook endpoint, and point Sanity's webhook straight at the host's build hook
([below](#rebuilding-when-content-changes)).

## The clients and queries

One client reads published content through Sanity's CDN. The preview client reads drafts with a
token, without the CDN. Both live in a `*.server.ts` module, so the token never reaches browser code
([LUM4003](../errors/LUM4003.md)), and are created on first use, when `env()` has the host's
variables.

```ts check file=server/sanity.server.ts
// src/server/sanity.server.ts
import { createClient, type SanityClient } from "@sanity/client";
import { env, signedCookie } from "lumiose";

/** Set by /api/preview; the preview route renders drafts only while it is valid. */
export const previewCookie = signedCookie("sanity-preview", { maxAge: 60 * 60 });

export interface Story {
  title: string;
  slug: string;
  summary: string;
  publishedAt: string | null;
}

let published: SanityClient | undefined;

function required(name: string): string {
  const value = env(name);
  if (value === undefined) throw new Error(`${name} is not set.`);
  return value;
}

/** Published content, through the CDN. With `preview`, drafts, with the read token. */
function sanity(preview = false): SanityClient {
  published ??= createClient({
    projectId: required("SANITY_PROJECT_ID"),
    dataset: required("SANITY_DATASET"),
    apiVersion: "2026-10-01",
    useCdn: true,
    perspective: "published",
  });
  return preview
    ? published.withConfig({
        token: required("SANITY_READ_TOKEN"),
        useCdn: false,
        perspective: "drafts",
      })
    : published;
}

const STORY = `{ title, "slug": slug.current, summary, publishedAt }`;

export function listStories(): Promise<Story[]> {
  return sanity().fetch(
    `*[_type == "story" && defined(slug.current)] | order(publishedAt desc) ${STORY}`,
  );
}

export function getStory(slug: string, preview = false): Promise<Story | null> {
  return sanity(preview).fetch(`*[_type == "story" && slug.current == $slug][0] ${STORY}`, {
    slug,
  });
}
```

Rich text (Portable Text) renders to HTML with a framework-agnostic library such as
`@portabletext/to-html`, written with `innerHTML`; this guide keeps a plain `summary` field.

## Reading content

Pages await their content in async components. `query()` caches each result for the request (or
the build), so a layout and a page that need the same story share one fetch
([Async components](../concepts/async.md)).

```stsx check file=components/Story.stsx
// src/components/Story.stsx
import type { Story as StoryData } from "../server/sanity.server.ts";

export function Story({ story }: { story: StoryData }) {
  return (
    <article class="story">
      <h1>{story.title}</h1>
      {story.publishedAt && <time datetime={story.publishedAt}>{story.publishedAt.slice(0, 10)}</time>}
      <p>{story.summary}</p>
    </article>
  );
}

<style>
  .story time { color: gray; }
</style>
```

```stsx check file=routes/stories/page.stsx
// src/routes/stories/page.stsx: built once per deploy
import { Title, href, query } from "lumiose";
import { listStories } from "../../server/sanity.server.ts";

export default async function Stories() {
  const stories = await query(["stories"], listStories);
  return (
    <main>
      <Title>Stories</Title>
      <ul>
        {stories.map((story) => (
          <li key={story.slug}>
            <a href={href("/stories/[slug]", { slug: story.slug })}>{story.title}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

```stsx check file=routes/stories/[slug]/page.stsx
// src/routes/stories/[slug]/page.stsx: one file per published story
import { Meta, Title, notFound, query, type PageProps } from "lumiose";
import { Story } from "../../../components/Story.stsx";
import { getStory, listStories } from "../../../server/sanity.server.ts";

export async function staticPaths() {
  return (await listStories()).map((story) => ({ params: { slug: story.slug } }));
}

export default async function StoryPage({ params }: PageProps<"/stories/[slug]">) {
  const story = (await query(["story", params.slug], () => getStory(params.slug))) ?? notFound();
  return (
    <main>
      <Title>{story.title}</Title>
      <Meta name="description" content={story.summary} />
      <Story story={story} />
    </main>
  );
}
```

## Previewing drafts

Drafts change on every keystroke and need a token, so they cannot be prerendered. A preview route
renders them per request, for people who opened the studio's preview link. The link carries the
secret; the endpoint checks it, sets a signed cookie and redirects to the preview page, which reads
the cookie on every request.

```ts check file=routes/api/preview/route.ts
// src/routes/api/preview/route.ts: GET /api/preview?secret=…&slug=…
import { env, href, type Endpoint } from "lumiose";
import { previewCookie } from "../../../server/sanity.server.ts";

export const mode = "server";

export const GET: Endpoint<"/api/preview"> = async ({ url, cookies }) => {
  const secret = env("SANITY_PREVIEW_SECRET");
  const slug = url.searchParams.get("slug");
  if (secret === undefined || url.searchParams.get("secret") !== secret || slug === null) {
    return new Response("Invalid preview link", { status: 401 });
  }
  await previewCookie.set(cookies, "1");
  return Response.redirect(new URL(href("/preview/stories/[slug]", { slug }), url), 307);
};
```

```stsx check file=routes/preview/stories/[slug]/page.stsx
// src/routes/preview/stories/[slug]/page.stsx: the draft, rendered per request
import { Meta, Title, cookies, notFound, query, response, type PageProps } from "lumiose";
import { Story } from "../../../../components/Story.stsx";
import { getStory, previewCookie } from "../../../../server/sanity.server.ts";

export const mode = "server";

export default async function StoryPreview({ params }: PageProps<"/preview/stories/[slug]">) {
  if ((await previewCookie.get(cookies())) !== "1") notFound();
  response().setHeader("cache-control", "private, no-store");
  const story =
    (await query(["story", params.slug, "drafts"], () => getStory(params.slug, true))) ?? notFound();
  return (
    <main>
      <Title>{`Preview: ${story.title}`}</Title>
      <Meta name="robots" content="noindex" />
      <p role="status">Preview of the latest draft.</p>
      <Story story={story} />
    </main>
  );
}
```

In the studio, point the preview link (the Presentation tool's preview URL, or a document action)
at `https://example.com/api/preview?secret=<SANITY_PREVIEW_SECRET>&slug=<slug>`. To refresh the
preview while an editor types, reload the page, or poll from an island that calls
`invalidate()` on an interval.

## Rebuilding when content changes

Published pages are files, so new content needs a new build. Most hosts give a build hook: a URL
that starts a deploy when something posts to it (Netlify build hooks, Vercel deploy hooks,
Cloudflare Pages deploy hooks, a CI workflow dispatch).

**Without a server:** in Sanity's dashboard, create a webhook that posts to the build hook on
create, update and delete, with the filter `_type == "story"`. No code runs in the app.

**With a server:** point the webhook at an endpoint instead. It verifies Sanity's signature (set a
secret on the webhook), so nobody else can trigger builds, keeps the build hook's URL off Sanity,
and can skip changes that do not affect the site:

```ts check file=routes/api/sanity/webhook/route.ts
// src/routes/api/sanity/webhook/route.ts
import { SIGNATURE_HEADER_NAME, isValidSignature } from "@sanity/webhook";
import { env, type Endpoint } from "lumiose";

export const mode = "server";

export const POST: Endpoint<"/api/sanity/webhook"> = async ({ request, platform }) => {
  const secret = env("SANITY_WEBHOOK_SECRET");
  const hook = env("BUILD_HOOK_URL");
  const signature = request.headers.get(SIGNATURE_HEADER_NAME);
  const body = await request.text(); // the exact bytes Sanity signed
  if (secret === undefined || hook === undefined || signature === null) {
    return new Response(null, { status: 400 });
  }
  if (!(await isValidSignature(body, signature, secret))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const { _type } = JSON.parse(body) as { _type?: string };
  if (_type === "story") platform.waitUntil(fetch(hook, { method: "POST" }));
  return new Response(null, { status: 202 });
};
```

The webhook posts JSON, which Lumiose's cross-site check leaves to the endpoint: the signature is
the check. Set the webhook's projection to `{_type}` (or more) so the body carries what the
endpoint reads.

## Common mistakes

- **Reading drafts on a static page.** A prerendered page cannot read cookies
  ([LUM5001](../errors/LUM5001.md)) and would bake one moment's draft into a public file. Keep
  drafts on the `server` preview route.
- **The read token in browser code.** It reads every draft; keep it in `*.server.ts`, and fetch in
  server components or endpoints.
- **Expecting published edits to appear without a build.** The pages are files: trigger a build
  from the webhook, or make the route `server` and read through the CDN on every request.
- **Verifying the webhook against re-serialized JSON.** Pass `await request.text()` to
  `isValidSignature`, then parse.
- **A preview page without `noindex` and `no-store`.** Search engines and shared caches would keep
  a draft. The preview page sets both.
