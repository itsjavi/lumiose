# `lumen/router`

> The client router for `spa` routes, built on the Navigation API: `<Link>`, `navigate()`, reactive `params()`, `search()`, `url()` and `navigating()`.

> **Status:** planned. In this version `lumen/router` exports nothing; the API below is the design
> (spec §7.5, decision-20) and may still change. MPA navigation (plain links, View Transitions)
> works without it.

## Planned API

| API                                                    | Behavior                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `<Link href prefetch="hover" \| "viewport" \| "none">` | A client-side link inside an `spa` subtree.                        |
| `navigate(href, { replace? })`                         | Navigate programmatically.                                         |
| `params()`                                             | Reactive params of the current route.                              |
| `search()`                                             | Reactive `URLSearchParams`, with a setter.                         |
| `url()`                                                | Reactive current URL.                                              |
| `navigating()`                                         | `true` while a navigation is in flight (also counted by `busy()`). |

Behavior:

- Nested layouts persist across navigations; a layout's `children` is the outlet.
- A navigation holds the old page until the new page's async content is ready, like a transition.
- Scroll restoration, focus management and a client-side `_404`.
- `invalidate()` re-runs the current page's async components.
- `submit()` redirects navigate through the router.

Until it lands, use `<a href>` links (MPA navigation) and `busy()` for global progress.

See also: [Routing](../concepts/routing.md), [Rendering modes](../concepts/rendering-modes.md).
