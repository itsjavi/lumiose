---
id: decision-68
title: Share a route group's CSS in a second file
date: '2026-10-16 23:21'
status: accepted
---
## Context

Found in the itsjavi.com port (TASK-285). The merged shared stylesheet was the longest common prefix of every page's stylesheet list. One page without the site chrome dropped the header, footer and catalog CSS from the shared file, so every other page's merged file repeated it.

## Decision

Orchestrator decision (Lux, 2026-10-17), from Nova's TASK-285.

The build now splits a page's CSS into up to three files:
1. **The every-page file.** The stylesheets every page starts with go into one shared file, as before.
2. **A group file.** Pages are grouped by the stylesheet that comes right after the every-page file. A group of 3 or more routes that continue with the same stylesheets, totalling more than 4 kB, gets its own shared file, one level deep. Only that group's pages link it.
3. **The page's own CSS.** As before, it is inlined up to 4 kB and otherwise merged into one file.

Each page's tags cover its own stylesheet list in order, so the cascade order is unchanged. A test checks this for every page.

## Consequences

- On the itsjavi.com port (39 pages), visiting every page drops from 12 requests and 29.2 kB to 8 requests and 15.3 kB (brotli).
- A first view of a grouped page makes one more request: at most 3 stylesheet tags instead of 2.
- apps/web and seven sample apps produce the same tags as before.
- There is no new option. The internal `StyleTags` data gains a `groups` field.
