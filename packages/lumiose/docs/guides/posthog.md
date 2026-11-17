# Product analytics with PostHog

> Start PostHog in `src/instrumentation.client.ts`, count page views on MPA pages and SPA navigations (`afterNavigate`), send events from islands, and evaluate feature flags on the server.

## 1. Install

```sh
pnpm add posthog-js posthog-node
```

| Variable                      | Where                                                                       |
| ----------------------------- | --------------------------------------------------------------------------- |
| `PUBLIC_POSTHOG_KEY`          | The build, for the browser (`phc_…`, the project API key: not a secret).    |
| `PUBLIC_POSTHOG_HOST`         | The build: `https://us.i.posthog.com`, `https://eu.i.posthog.com` or yours. |
| `POSTHOG_KEY`, `POSTHOG_HOST` | The server, for `posthog-node` (the same key).                              |

## 2. Start PostHog

`src/instrumentation.client.ts` is the one file every page loads, also pages without islands.
Automatic page views are off: the file counts each document load once.

```ts check
// src/instrumentation.client.ts
// posthog-js is large: load it without holding back hydration.
void import("posthog-js").then(({ default: posthog }) => {
  posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Page views are counted here and in <PageViews>.
    capture_pageview: false,
    person_profiles: "identified_only",
  });
  // Every document load: an MPA page, or an SPA's first page.
  posthog.capture("$pageview");
});
```

> **Size:** `posthog-js` is about 300 kB of JavaScript (85 kB brotli). A static import would hold
> back hydration on every page until it ran, so the file uses `import()`.

## 3. Count SPA navigations

An SPA navigates on the client, so no document loads:
[`afterNavigate`](../reference/router.md#afternavigate) counts those navigations. Render the
component once, in the outermost `spa` layout, where it stays mounted across navigations.

```tsx check file=components/PageViews.tsx
// src/components/PageViews.tsx
import posthog from "posthog-js";
import { afterNavigate } from "lumiose/router";

export function PageViews() {
  afterNavigate((navigation) => {
    // "enter" is the document load, counted in step 2.
    if (navigation.type === "enter") return;
    if (navigation.to === null) return;
    posthog.capture("$pageview", {
      $current_url: navigation.to.url.href,
    });
  });
  return null;
}
```

```stsx check file=routes/workspace/layout.stsx
// src/routes/workspace/layout.stsx
import type { LayoutProps } from "lumiose";
import { PageViews } from "../../components/PageViews.tsx";

export const mode = "spa";

export default function Workspace(
  props: LayoutProps<"/workspace">,
) {
  return (
    <div class="workspace">
      <PageViews />
      {props.children}
    </div>
  );
}
```

## 4. Send events

Islands import `posthog` and send events from handlers. They share the instance that step 2
starts, which is ready long before a person clicks.

```tsx check file=components/PlanButton.tsx
// src/components/PlanButton.tsx: an island
import posthog from "posthog-js";

export function PlanButton(props: { plan: string }) {
  const select = () => posthog.capture("plan_selected", { plan: props.plan });

  return <button onClick={select}>Choose {props.plan}</button>;
}
```

> **Users:** to tie events to your users, call `posthog.identify(userId)` in an island once the
> person is signed in, and `posthog.reset()` on sign-out.

## 5. Evaluate flags on the server

A flag read in the browser arrives after the page shows, so the page would switch variants in
front of the reader. Evaluate it while the page renders, with the same distinct id the browser
uses: your user id once identified, here the `locals().userId` that your middleware stores
([Server](../concepts/server.md)).

```ts check file=server/posthog.server.ts
// src/server/posthog.server.ts
import { env } from "lumiose";
import { PostHog } from "posthog-node";

let client: PostHog | undefined;

export function posthog(): PostHog {
  const key = env("POSTHOG_KEY");
  if (key === undefined) throw new Error("POSTHOG_KEY is not set.");
  const host = env("POSTHOG_HOST") ?? "https://us.i.posthog.com";
  return (client ??= new PostHog(key, { host }));
}
```

```stsx check file=routes/plans/page.stsx
// src/routes/plans/page.stsx
import { Title, locals } from "lumiose";
import { PlanButton } from "../../components/PlanButton.tsx";
import { posthog } from "../../server/posthog.server.ts";

// A flag depends on the reader, so this is a server route.
export const mode = "server";

export default async function Pricing() {
  // Whatever your middleware stores in locals.
  const user = locals().userId ?? "anonymous";
  const annual = await posthog().isFeatureEnabled(
    "annual-pricing",
    user,
  );
  return (
    <main>
      <Title>Plans</Title>
      <h1>{annual ? "Pay yearly, save 20%" : "Plans"}</h1>
      <PlanButton
        client:load
        plan={annual ? "team-yearly" : "team"}
      />
    </main>
  );
}
```

## Production

- **Serverless.** `posthog-node` batches its own events (such as `$feature_flag_called`): flush
  before the function ends with `ctx.platform.waitUntil(posthog().flush())`.
- **CSP.** With `lumiose({ csp: "strict" })`, `posthog-js` is bundled with your code, so the
  policy allows it. Its extensions (surveys, session recording) load further scripts from
  PostHog's host, which a strict policy refuses: keep them off, or set your own policy for them
  ([Security](../concepts/security.md)).
- **Ad blockers** often block PostHog's hosts: PostHog documents a reverse proxy, which in
  Lumiose can be middleware or an endpoint that forwards `/ingest/*` to PostHog.
- **Consent.** Ask for it where the law requires it before `posthog.init()` (or start with
  `opt_out_capturing_by_default: true` and call `posthog.opt_in_capturing()`).

## Common mistakes

- **Leaving automatic page views on.** PostHog's history-based page views and the ones of step 3
  would count SPA navigations twice; keep `capture_pageview: false`.
- **`afterNavigate` in a page instead of the layout.** A page is replaced on navigation, so its
  hook would see only its own `"enter"`.
- **A static `import posthog from "posthog-js"` in the instrumentation file.** Every page then
  waits for 300 kB of JavaScript before its islands hydrate.
- **Reading flags in the browser for content above the fold.** Evaluate them on the server.
- **The server key in browser code.** Only `PUBLIC_*` variables reach `import.meta.env`; keep
  `posthog-node` in `*.server.ts` modules.

> **Status:** checked on 2026-10-15 with a Lumiose app built with `lumiose build` and served by
> `lumiose preview`, against a local stand-in for PostHog's API: one `$pageview` per MPA page
> load, per SPA document load and per SPA navigation, the island's event, and the server's flag
> evaluation. Not run against a PostHog project. Packages: `posthog-js` 1.438, `posthog-node` 5.55.
