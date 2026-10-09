---
id: decision-26
title: >-
  Route typing ergonomics, route identity, .md headings, headers option,
  create-lumen --mcp
date: '2026-10-09 04:25'
status: accepted
---
## Context

Prism's DX review of the three sample apps (TASK-38) found boilerplate and unchecked casts around route typing (`ActionContext<RouteParams<"/books/[isbn]">>`, hand-typed layout props, `actionData<T>()` casts), hand-matched pathnames in the SPA, a custom Markdown pipeline in the SSG sample only because `.md` modules lack headings, response headers declared in three places, and no project MCP config from `create-lumen`. On 2026-10-09 the user approved all six proposals (B1–B6) and delegated the exact typing shape: "get inspired by nextjs and react-router typing ergonomics, whatever u consider best DX for agents and devs and less ambiguous", and asked that `--mcp` also work with Codex.

## Decision

**1. Route-literal type helpers (B1, B2).** Following Next.js's `PageProps<"/blog/[slug]">`/`LayoutProps<"/dashboard">` and React Router's generated per-route types, every route-bound type takes the route pattern literal, checked against the typegen route table (an unknown or stale pattern is a type error, and editors autocomplete it). One form only; the params-object generic form is removed (pre-1.0).
- `PageProps<"/books/[isbn]">` → `{ params }` (replaces `RouteProps`).
- `LayoutProps<"/books">` → `{ params, children }`.
- `RequestContext<P>`, `ActionContext<P>`, `Action<P>`, `Endpoint<P>` take the pattern: `export const actions = { save: (ctx: ActionContext<"/books/[isbn]">) => … }`.
- Action results are inferred from the `actions` export, never cast: `actionData<typeof actions>()` returns the union of every action's data and `fail()` data (or `undefined`), told apart by shape as with React Router's `useActionData` and SvelteKit's `form` (no runtime marker; amended 2026-10-09); `ActionData<typeof actions>` names that type for the props of a component that receives it; `submit<typeof actions.save>(form)` infers its data and failure types, discriminated by `type`. A single `export const action` works the same with `typeof action`.

React Router's `./+types/<route>` import was considered: it avoids repeating the pattern, but relies on a generated relative path per file that agents often get wrong; Lumen already uses pattern literals (`RouteParams`, `href()`), so one convention covers everything.

**2. Route identity (B3).** `route()` returns the matched route pattern, typed as the `Routes` union (`"/songs/[id]" | …`), wherever `url()` and `params()` are available (server render, client router, islands). Apps compare patterns instead of matching `url().pathname` strings.

**3. `.md` headings (B4).** A `.md` module also exports `headings: ReadonlyArray<{ depth: 1 | 2 | 3 | 4 | 5 | 6; text: string; id: string }>`, in document order, with the same ids as the rendered heading anchors.

**4. `lumen({ headers })` (B5).** One option for response headers: a record applied to every response, or an array of `{ path, headers }` where `path` is a URL pattern (`*` one segment, `**` any depth). Applied by `lumen dev`, `lumen preview` and adapter-node, and emitted as a `_headers` file for prerendered output on hosts that read it. Headers set by middleware, endpoints or `setHeader` win.

**5. `create-lumen --mcp` (B6).** Opt-in. `create-lumen --mcp` and `lumen agents init --mcp` register `lumen mcp` for Claude Code (project `.mcp.json`) and Codex (its project config if supported, otherwise the printed `codex mcp add` command), using the project's package-manager runner.

## Consequences

- Samples, templates, docs and the generated AGENTS.md section switch to the new helpers; `RouteProps` and the params-object generics disappear.
- Typegen must emit layout routes and per-action types; `route()` needs the matched pattern on the server and in islands.
- Tasks: TASK-127 (typing, Beacon), TASK-128 (`route()`, Spark), TASK-129 (headings, Halo) with TASK-130 (SSG sample on native `.md`), TASK-125 (headers, Nova), TASK-131 (`--mcp`, Beacon).
