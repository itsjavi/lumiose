---
id: decision-78
title: Strict-CSP style props share one ID-weighted rule per declaration block
date: '2026-10-23 08:54'
status: accepted
---
## Context

Under `lumiose({ csp: "strict" })` the server cannot write `style="…"` attributes, so it wrote each style prop as a `[data-l-v="N"]{…}` rule of a nonce'd `<style>`, one per element (spec §7.4). A port of a private app (TASK-521) found two problems:
- **Precedence.** The rule weighs one attribute selector. A component's scoped rule (`.x[data-l-hash]`), or a later default of the same weight, wins over it, where an inline style wins over every normal rule. Pages render differently with and without strict CSP, and an island's element changes when it hydrates.
- **Size.** A list of about 1,600 items with three style props per item wrote about 4,800 rules.

The delta security review (TASK-497) also found that the closing of open constructs (TASK-472) read `éurl(` and `\7b url(` as url tokens, while browsers read functions there, so a `/*` after them swallowed the next rules.

Two ways to restore precedence were weighed:
- **`!important` declarations.** Closest to an inline style against normal rules. But they would win over CSS animations, which an inline style does not. They would also win over the styles the client sets through the CSSOM after hydration: the client keeps `data-l-v` because the rule still carries the element's static declarations, so a stale server value would hide every update.
- **A heavier selector.** It stays a normal declaration, so animations, `!important` rules and the client's inline styles keep winning over it, as over an inline style.

## Decision

Orchestrator-delegated technical decision (Nova, TASK-521 and TASK-497, 2026-10-23). The public API and syntax do not change.

- **Selector.** A strict style rule reads `[data-l-v="N"]:not(#a#b){…}`. `:not(#a#b)` matches every element, since no element has two ids, and adds the weight of two ids: (2,1,0) in all. It beats class, attribute and one-id selectors, and normal rules of equal weight that come earlier.
- **Sharing.** Identical declarations share one rule and one `N` within a response. An element reuses a rule only when it is in the document by the time the element is: the rule belongs to the element's own unit, to a unit that unit streams inside, or to a unit already flushed. Otherwise it gets a new rule, since a pending sibling boundary may fail and never send its `<style>`.
- **Isolation.** `url(` is treated as a url token only right after whitespace or punctuation that is always a token by itself. After anything else (an identifier character, `#`, `@`, `-`, an escape, non-ASCII), tokenizers may disagree (non-ASCII identifier ranges, WebKit's unicode-range token), so the rule gets a `<style>` of its own: whatever it leaves open ends with that element. Only CSS whitespace counts before the quote of a `url("…")` function.

## Consequences

- The cascade matches an inline style in Chromium, Firefox and WebKit for scoped rules, id rules, later `:where()` defaults, `!important` rules, animations and CSSOM styles after hydration. This was checked with Playwright, with the same computed values with and without strict CSP. Only a selector that weighs more than (2,1,0), or as much and comes later, still wins over a strict style rule where it would not win over an inline style; it needs two ids or more.
- The list of about 1,600 items writes 113 rules instead of about 4,800: 105,672 bytes instead of 252,212, less than the 129,974 bytes of inline `style` attributes.
- Fuzzing 8,000 adversarial values in the three engines left no rule swallowed after it. The rare values with an uncertain `url(` cost one `<style>` (and one hash on prerendered pages) each.
- The `data-l-v` values are no longer unique per element. Nothing in the client reads them; it only checks whether an element has one (below).
- One limitation remained, which this decision did not address: after hydration, a style property the client removed fell back to the server rule's value, because the client kept `data-l-v`. TASK-526 resolved it: strict builds set every declaration of a style prop through the CSSOM while the island hydrates, the static ones included, so the first style write to a claimed element drops its `data-l-v`.
