# Stability

> What Lumiose promises today and at 1.0: when releases may break, what 1.0 needs, what the API freeze covers, the supported runtimes and browsers, and who maintains it.

## Before 1.0

Lumiose is 0.x. **Any minor release may break** the API (0.4 to 0.5), and until real usage starts,
breaking changes ship without migration paths: no deprecation aliases, no compatibility shims and
no upgrade guides. The docs always describe the current API only, and the changelog lists every
change.

That rule ends at the first known **external production app** or at 1.0, whichever comes first.
From then on, every breaking change comes with a migration path.

No external production app is known yet, so the rule above is in force.

## External production apps

An external production app is an app in production that:

- is on the opt-in [Used by](https://lumiose.dev/showcase/#used-by) list, added through a
  pull request with its URL;
- is not run by the Lumiose maintainer (the maintainer's own sites, such as itsjavi.com, do not
  count).

Lumiose never collects telemetry: the Used by list is the only usage signal.

## The 1.0 criteria

Lumiose becomes 1.0 when all of these hold:

1. **The 1.0 essentials are done**: deploy targets and self-hosting, `useId`, head defaults, the
   authentication and realtime guides, View Transitions, the Next.js-aligned route files, i18n
   routing and a smoother dev reload (milestone M9 in the project's backlog).
2. **The extension points are done**: folder middleware with `ctx.route`, a client entry hook,
   router lifecycle hooks, per-instance form submissions, server and client instrumentation, a dev
   handler for custom servers, and the Coming from guides (milestone M10).
3. **The API is frozen** (below).
4. **Three external production apps** are on the Used by list.
5. **An external security review** by an independent reviewer has been done.

## What the freeze covers

From 1.0, everything public follows semantic versioning: only a major release breaks it.

- The exports of `lumiose` and of every `@lumiose/*` package released in lockstep with it.
- The file conventions: `src/routes` and its special files, `src/document.stsx`,
  `src/middleware.ts` and the other project files the framework reads.
- The config options of `lumiose()` and the adapters.
- The CLI commands and flags.
- The meaning of each `LUMxxxx` diagnostic code. Codes are never reused.

`@lumiose/ui` keeps its own 0.x versions and joins the freeze at its own 1.0.

**After 1.0, new APIs ship with an `unstable_` prefix** (`unstable_name`) until a minor release
promotes them, as React Router does. There are no `unstable_` names before 1.0, and no experimental
config flags.

## Runtimes

Lumiose runs on **Node.js 24 and later**. Node.js 22 is not supported (it reaches end of life in
April 2027); the [Node.js release schedule](https://nodejs.org/en/about/previous-releases) lists
the dates of each line. The server build also runs on Bun, Deno and the platforms of the
[deploy adapters](deploy/README.md).

## Browsers

The browser code targets the browsers covered by
[Baseline widely available](https://web.dev/baseline), re-checked at each release. A newer platform
feature is used only with a fallback (View Transitions and speculation rules are progressive: other
browsers navigate normally).

Production CSS is minified for Chrome and Edge 123, Firefox 124 and Safari 17.5 (Baseline widely
available on 2026-10-01, with the Safari release that brought `light-dark()`), so syntax they all
support, such as `:dir()`, nesting and `light-dark()`, stays as written. A `build.cssTarget` or
`build.target` in your Vite config replaces that list.

## Security

Until 1.0, only the latest minor release receives security fixes. Report vulnerabilities privately,
as described in the [security policy](https://github.com/itsjavi/lumiose/blob/main/.github/SECURITY.md).

## Maintenance

- **Who:** Lumiose is designed and maintained by one person, Javi Aguilar
  ([itsjavi](https://github.com/itsjavi)). A second human maintainer is a goal; it is not a 1.0
  criterion.
- **Releases:** there is no fixed schedule. A minor release ships when a batch of work is ready
  (0.1 to 0.4 shipped within a week in October 2026), and security fixes ship in a new release of
  the latest minor. `lumiose` and the `@lumiose/*` packages are released in lockstep, with one
  version number.
- **Intent:** to reach 1.0 on the criteria above and to keep Lumiose maintained after it, under the
  stability rules on this page. Work is planned in the open, in the repository's backlog.

If these terms do not fit your project yet, read [When not to use Lumiose](when-not-to-use.md).
