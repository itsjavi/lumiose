---
id: decision-9
title: >-
  Island protocol: usage-site client directives, comment markers, data-only
  serialization
date: '2026-10-08 10:28'
status: accepted
---
## Context

Decision-4 made rendering server-first, with islands and per-route SPA. This decision fixes how island boundaries are declared, delimited in HTML, booted and serialized.

How other frameworks do it:

| Framework | How islands are declared and delimited | Notes |
|---|---|---|
| Astro | Usage-site `client:*` directives, rendered as `<astro-island>` wrappers | The wrapper breaks child-combinator CSS |
| Remix 3 | `clientEntry` at the definition site, comment markers, one JSON data script | |
| Solid | Hydration keys on every element (`_hk`) | Costs SSR bytes and time |
| Svelte 5 | Positional cursor walk with comment markers | |

The React Flight remote code execution vulnerability (CVE-2025-55182) showed the danger of rich deserialization.

## Decision

**Declaring islands**
- Islands are declared at the usage site with `client:load | client:idle | client:visible | client:media="…" | client:only`.
- The directive is typed on every component via `IntrinsicAttributes`.
- The compiler resolves the component's module specifier and export name. A local, non-exported component is an error (`LUM4001`).

**Delimiting islands in HTML**
- No wrapper element. Islands are delimited by comment markers `<!--l:ID-->…<!--/l:ID-->`.
- Each flushed chunk has one `<script type="application/json" data-l-islands>` with the island records.

**Hydration**
- Hydration is positional claiming using the same compiled walk as creation.
- Comment markers appear only around dynamic blocks and text separators, never as per-element keys.

**Loader**
- An external loader of about 1 kB arms the triggers, imports the island's module and hydrates it.
- It captures and replays early events.
- `client:load` islands get a `modulepreload` hint. Since TASK-566 (0.7.1), `client:only` islands get one too, and the hints cover the island chunk's whole static import closure, so shared chunks load in parallel instead of in a second wave.

**Serialization**
- Data-only: JSON, or seroval in JSON mode. Nothing is evaluated during deserialization.
- Non-serializable props raise `LUM4002` in development, and in `lumen check` on a best-effort basis.

**Server/client separation**
- `*.server.*` modules and `src/server/` are forbidden in client graphs (`LUM4003`).
- ~~An async component reachable from a client graph is an error (`LUM4005`).~~ Dropped: async components are allowed on the client (decision-13).

**Other modes**
- An SPA subtree is a single root island.
- `csp: "strict"` mode adds nonces and moves per-instance style values into nonce'd `<style>` rules.

## Consequences

- One hydration mechanism serves islands, streamed chunks and SPA subtrees.
- The DOM structure, and therefore CSS selectors, is unaffected by islands.
- Island children are static, server-rendered HTML; they are reactive only if they are themselves islands.
- Without a TS 7 API, serializability can only be partly enforced at the type level.


_Accepted 2026-10-08. The syntax was approved by the user (compiled `.map()`/ternaries; `client:*` directives at the usage site), and the remaining technical parts by Lux under decision-16._
