---
id: TASK-472
title: 'Security review, Low: core (L1, L3 to L7)'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: medium
ordinal: 470000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**Form values and core**

- **L1. Form `values` fill a password or hidden input whose `type` isn't lowercase.**
  - `packages/ui/src/input/input.tsx:37` `UNFILLED` is case-sensitive: `type="PASSWORD"` or `"Password"` renders `value="<the password>"`, and `type="HIDDEN"` replaces a server default.
  - Also: two controls that share a name both get filled (a text `token` takes a password `token`), and a native `<fieldset disabled>` is not honoured (only `Fieldset.Root` is).
  - Contradicts form.md ("never filled"). Confirmed (SSR).
  - Fix: lowercase and trim `type`; document name matching and the native fieldset.
  - Task: "Form values: case-insensitive UNFILLED check; document name collisions"
- **L2. SVG keeps external resource references.** `<use>`/`<image>`/`<feImage>` `href` with http(s)/data, and `<style>` `@import`/`url()`, survive. A third-party icon then beacons viewers to an external host; outbound requests were observed, no script ran.
  - Fix: decide a policy (same-origin or no external refs for imported icons), or document it and recommend a CSP.
  - Task: "SVG: policy for external resource references in imported icons"
- **L3. `srcdoc` is an HTML sink the URL guard doesn't cover.** A dynamic `srcdoc={x}` renders, and its script runs with the parent's origin (3 engines).
  - Fix: treat it like `innerHTML` (an explicit opt-in or a dev warning, LUM4009-style) and add it to security.md.
  - Task: "Unsafe sinks: srcdoc like innerHTML"
- **L4. The body limit depends on the client's Content-Type.** `packages/lumiose/src/app/server/body.ts` `limitOf`: declaring `multipart/form-data` raises any route's limit from `body` (1 MB) to `upload` (10 MB), including JSON endpoints that call `request.json()`. Static reading.
  - Fix: apply `upload` only where the route reads multipart, or cap non-form parsers at `body`.
  - Task: "Body limits: upload limit only for multipart parsing"
- **L5. Strict-CSP style rules can be broken from a dynamic `style` value.** `packages/lumiose/src/server/attrs.ts:126` escapes `{ } < \` but not `/*` or an unclosed `url(`. Either swallows the following `[data-l-v]` rules in the same `<style>`: other elements lose their inline styles. No script. Static reasoning from CSS tokenizing.
  - Fix: also escape `*` and `/`, or emit one rule per `<style>`.
  - Task: "Strict styles: a style value cannot comment out later rules"
- **L6. No framing protection by default.** `DEFAULT_HEADERS` (nosniff, referrer-policy) and the strict policy lack `frame-ancestors`/`X-Frame-Options`, so form actions can be clickjacked unless the app adds them.
  - Fix: `frame-ancestors 'self'` in the strict policy, and consider `X-Frame-Options: SAMEORIGIN` by default.
  - Task: "Default headers: framing protection"
- **L7. Inline JSON (JSON-LD) has no safe documented path.** `{JSON.stringify(x)}` children are HTML-escaped (`&lt;` corrupts the data), and `innerHTML={JSON.stringify(x)}` lets `</script>` break out: XSS without CSP, injected markup with it.
  - Fix: `<script>` elements with a JSON type serialize text children like `jsonForScript` (`<` → `<`), or export that helper and document JSON-LD.
  - Task: "JSON script blocks: safe serialization"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L1: UNFILLED is case-insensitive, and name collisions and a native disabled fieldset are handled or documented
- [ ] #2 L3: srcdoc is treated like innerHTML
- [ ] #3 L4: the upload limit applies only to multipart parsing
- [ ] #4 L5: a style value can't comment out later strict-CSP rules
- [ ] #5 L6: the strict policy sets frame-ancestors 'self' (a default X-Frame-Options header goes to doc-10)
- [ ] #6 L7: JSON script blocks serialize safely, and JSON-LD is documented
<!-- AC:END -->
