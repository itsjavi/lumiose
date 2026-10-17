---
id: TASK-472
title: 'Security review, Low: core (L1, L3 to L7)'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:52'
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
- [x] #1 L1: UNFILLED is case-insensitive, and name collisions and a native disabled fieldset are handled or documented
- [x] #2 L3: srcdoc is treated like innerHTML
- [x] #3 L4: the upload limit applies only to multipart parsing
- [x] #4 L5: a style value can't comment out later strict-CSP rules
- [x] #5 L6: the strict policy sets frame-ancestors 'self' (a default X-Frame-Options header goes to doc-10)
- [ ] #6 L7: JSON script blocks serialize safely, and JSON-LD is documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-17): claimed, branch claude/nova-css-0fc0df. L2 is not in this task's AC (SVG policy); left alone.

Nova (2026-10-17): L1 in 9116c801 (packages/ui, Halo's area: Input's UNFILLED is case-insensitive and trims; form.md documents name-only matching and that a native <fieldset disabled> is not seen; test fails before the fix). L3-L6 in bfd1e764. L3: innerHTML has no runtime guard in Lumiose (explicit raw-HTML prop, documented, strict CSP blocks scripts injected through it), so srcdoc gets the same: security.md 'Raw HTML' paragraph and the srcdoc typing doc; verified in Chromium/Firefox/WebKit that a srcdoc frame runs an injected script with parent access without CSP and is blocked under the strict policy (it inherits it). A stronger guard (dev warning, or blocking dynamic srcdoc without sandbox) changes DX: proposed for doc-10. L4: boundedRequest's json()/text() use limits.body whatever Content-Type says; formData() and raw reads of multipart keep upload (custom upload parsers keep working); property test fails before the fix; security.md updated. L5: styleAttr closes the comment, string, url( and ()/[] a value leaves open (closeOpen), so later [data-l-v] rules hold: 5 attack shapes lost the next rule in all 3 engines before, none after; unit test. L6: noncePolicy adds frame-ancestors 'self'; the prerendered <meta> policy leaves it out (browsers ignore it there) and security.md says how to send it as a header; X-Frame-Options default already in doc-10. L7: pending, needs a compiler change (asked Lux).

Validation (Nova, 2026-10-17): pnpm check exit 0 (2549 tests); pnpm pack:check --smoke --skip-npm exit 0; Playwright: apps/web 179 passed, ssg-spa-e2e 19, ssg-travel-journal 17, ssr-auth 6, ssr-bookshelf 17, ssr-i18n-i18next 5, ssr-i18n-paraglide 5, ssr-realtime 9, ssr-styles-e2e 10. L7 status: JSON-LD is documented (security.md: innerHTML with < as \u003c, commit e91d2623), but JSON script blocks do not serialize safely yet: that needs crates/lumiose_compiler (Photon's area), filed as TASK-479; asked Lux whether Nova may do it. AC #6 stays open. Claim released; the task stays In Progress until L7 lands. For doc-10 (Lux): whether srcdoc should also get a guard beyond innerHTML's treatment (a dev warning, or blocking a dynamic srcdoc without sandbox).
<!-- SECTION:NOTES:END -->
