---
id: doc-10
title: Pending decisions for the user
type: other
created_date: '2026-10-16 22:28'
updated_date: '2026-10-24 15:40'
---
Decisions that need the user, collected while Lux and the workers run unattended (user request, 2026-10-17: "do not block yourself on more questions … postpone them (and their decisions) in a document that can be used later as follow ups").

Each item has:
- what is waiting;
- the options;
- Lux's recommendation;
- what happens meanwhile.

Nothing here is decided until the user answers. Answered items move to the Answered section with the date, and are recorded in the decision or task they belong to.

## Open

**Backlog state (2026-10-17):** every task that doesn't wait on an item below is done. The workers are idle until the user answers.

### P1. Push main to origin

- Every push needs the user's OK, because it runs CI, which costs money (AGENTS.md).
- For the unattended run that started on 2026-10-23, the user allowed batched pushes of main (see Answered).
- **Meanwhile:** outside that run, commits stay local until the user approves a push.

### P2. The screen reader pass (TASK-361)

- **Waiting:** the user, who chose on 2026-10-16 to run VoiceOver and NVDA themselves. The per-component checklist is in TASK-361's notes. It also covers Prism's M23 (the announcements of Combobox's Empty and Status).
- **Meanwhile:** nothing blocks on it.

### P5. The spa template: what it renders (TASK-276)

- **Waiting:** the spa template sets `mode: "spa"` with the defaults ssr = true and prerender = false. So it renders on the server per request, yet it ships no server and its descriptions say "client-rendered".
- **Options:**
  - (a) prerender the pages: a static deploy, a prerendered first paint, client routing;
  - (b) `ssr = false`: a shell only;
  - (c) keep server rendering and add the Node server.
- **Recommendation:** (a), as the TASK-275 audit suggested.
- **Meanwhile:** the template is unchanged.

### P6. Diagnostics print the online docs URL (TASK-265)

- **Waiting:** the message shape, a DX question. Compiler and CLI diagnostics would also print `https://itsjavi.com/lumiose/docs/errors/LUMxxxx`; the browser runtime would not, to keep its size.
- **Recommendation:** yes, as one extra line after the existing `lumiose explain <code>` hint.
- **Meanwhile:** unchanged.

### P7. LUM2001 in server-only components (TASK-290)

- **Waiting:** a diagnostics and DX call. The compiler can't know whether a component ever runs in the browser.
- **Options:**
  - keep the warning as it is;
  - lower it to a hint for values derived from props;
  - add a per-file or per-component opt-out.
- **Recommendation:** keep it, and document the lazy-derivation idiom. Most such values are real reactivity bugs once the component is used in an island.
- **Meanwhile:** unchanged.

### P8. Proposals waiting for review

These are syntax, DX or API proposals. Each task holds the proposal; nothing is built until the user approves.
- TASK-279: first-party responsive images.
- TASK-280: frontmatter-only Markdown imports for listings.
- TASK-281: a Markdown transform hook and typographic quotes.
- TASK-282: warn on scoped descendant selectors that match other files' elements.
- TASK-286: an option to skip precompressed copies in static builds.
- TASK-287: sitemap and redirects options for static sites.
- TASK-519: inline or combine small `?client` scripts.
- TASK-544: a tooltip on a link (`Tooltip.Trigger` with `render` or `as`).
- TASK-545: per-component theme stylesheets in @lumiose/ui.
- TASK-565: a headless virtualizer in @lumiose/ui (Halo is prototyping it, to show it working before you decide).
- TASK-564: typed URL state (search param schemas) in lumiose/router.
- TASK-560: a Dock and sticky-bar primitive in @lumiose/ui.
- TASK-561: SVG icon sprites (site-kit or a Vite option).

### P9. Agent eval runs (TASK-185, 207, 208, 209, 243)

- **Waiting:** evals cost money, so they never run without the user's permission (AGENTS.md).
- **Recommendation:** TASK-207 (three repeats per frontier model) first. TASK-243's /evals page depends on its results.
- **Meanwhile:** eval files can be edited, but nothing runs.
- **On hold (decision-70, 2026-10-20):** evals get no new work unless a port shows agents struggling.

### P10. External security review before 1.0 (TASK-310)

- **Waiting:** the user, to choose and engage an external reviewer.
- **Meanwhile:** the internal pre-release review (P4) still runs.

### Blocked upstream (no decision needed)

- **TASK-64:** waits for a Lightning CSS release after 1.33.0 that includes PR #1329. It was still 1.33.0 on 2026-10-17.
- **TASK-264:** waits for the arm64 musl compiler package on npm, which comes with the next lumiose release.

### P11. Compiler behaviour changes from TASK-347, 348 and 349 (Photon, 2026-10-17)

Merged as bug fixes; listed here because they change what code means. Each can be revisited.
- **Destructuring props in a component body is reactive.** `const { children, ...rest } = props` used to read once at setup. It is now rewritten like destructured parameters, so the values stay live and the line no longer warns LUM2001.
- **A spread with no content of its own renders the props' `children`.** An element such as `<button {...props} />` now renders `props.children` when the props object has that key, and otherwise leaves the content alone. `children` is never written as an attribute.
- **No LUM2001 for constants.** `useId()`, `ref()`, `signal()`, `createContext()` and `getAbortSignal()` no longer count as reactive reads.
- **Recommendation:** keep all three, since they match React and Solid.

### P12. Installing on platforms without a native compiler binary (decision-67, TASK-289)

- **What changed:** the WebAssembly compiler package now declares `cpu: ["wasm32"]`, as napi-rs prescribes and oxc, Tailwind's oxide and Astro do. Darwin-arm64, Linux and the other native platforms no longer download it (11.4 MB).
- **The cost:** platforms with no native binary (Windows on Arm, FreeBSD, WebContainers) must enable wasm32 before installing: pnpm `supportedArchitectures` or npm `cpu=wasm32`. The docs say so.
- **Option:** add a native `win32-arm64-msvc` build, which removes that step on Windows on Arm, for one more CI job per release.
- **Recommendation:** keep decision-67, and add the Windows on Arm build only if someone asks.

### P13. Security defaults from the pre-release review (Prism, 2026-10-17)

The review found 1 High, 3 Medium and 14 Low, now TASK-468 to TASK-475. Their fixes are underway. Publishing (P3) waits for the High (TASK-468) and the Mediums. Two items need the user:
- **A default `X-Frame-Options: SAMEORIGIN` header (L6).** `frame-ancestors 'self'` goes into the opt-in strict CSP either way (TASK-472). A default header would also protect apps without strict CSP, but it breaks apps that are meant to be embedded until they opt out.
  - **Recommendation:** add it as a default, with an option to turn it off.
  - **Meanwhile:** strict CSP only.
- **A `pick(form, names)` helper for echoing form values (M3).** The docs will teach an explicit record, which needs no new API: `values: { username: form.get("username") }`.
  - **Recommendation:** no helper for now; revisit if the record form proves verbose in practice.

### P14. Select loads a script for labelled items (TASK-537, for review)

- **Not blocking:** done in @lumiose/ui 0.1.2. The user can reverse it.
- **Why:** Chromium and WebKit hide an option's content whenever it has a `label` attribute, and CSS cannot override that. The classic select needs the attribute, so no markup works in both.
- **What changed:** a select with labelled items now loads a 0.19 kB brotli script. In a customizable select, it removes the attribute as the picker opens (classic selects keep it), so the item's content shows. Items without `label` ship no script, as TASK-358 promised for every item.
- **Alternative:** no script, and the docs say not to use `label` on items whose content starts with an icon.


## Answered

### 2026-10-24: 0.7.0

- **P15 (TASK-549):** the user confirmed both parts.
  - On MPA pages, `beforeNavigate` reports link clicks as `"link"`.
  - `cancel()` keeps the page for links and `navigate()` to other documents, and the browser prompt stays for `"leave"` only.
  - decision-50's amendment is confirmed.
- **Keyed rows update in place (F1, decision-83):** approved by the user. It ships with F3 (no more silently dropped keys, LUM2008).
- **Spark's defaults, accepted:**
  - the client runtime 0.13 kB over its 6.25 kB soft target (6.38 kB);
  - LUM2001 in keyed rows counts calls to the app's own functions as stale reads;
  - +1.2 ms of script when replacing rows whose child components read the item through props;
  - a binding that stopped reading the item before the first in-place change re-runs once.
- **Release:** a security review since 0.6.0, then `pnpm release:version 0.7.0`. The tag push waits for the user's OK.

### 2026-10-23: @lumiose/ui on npm, and the unattended run

- **Publishing (was P3 and P4):** the user published @lumiose/ui 0.1.0 by hand. 0.1.1 then went out through release.yml with trusted publishing and provenance, which proves the publisher (TASK-389, Done). The screen reader pass (P2) no longer gates it.
- **GitHub's Latest release** stays the newest Lumiose version: release.yml creates package releases with `--latest=false`, and v0.6.0 is Latest again.
- **Unattended run:**
  - Lux pushes main after each finished, green batch, never backlog-only commits.
  - Patch releases of Lumiose 0.6.x and @lumiose/ui 0.1.x go through `pnpm release:version`, with their tags pushed. No minor releases.
- **Next work:** the private app's list and detail port on the latest Lumiose with @lumiose/ui, then its forms, actions and auth port (TASK-493).

### 2026-10-20: what Lumiose is for (grilling session)

- **Purpose, evidence and focus:** decision-70, with milestone M13 and the scorecards in doc-11.
- **TASK-283 (small client scripts, from P8):** decision-71. `?client` is the only mechanism, and data goes through attributes.
- **Repository root:** decision-72.
- **Extracting the chiptune apps and gbapu:** decision-73.
- **npm publishing (P0, 2026-10-21):** the v0.5.0 publish failed on the `NPM_TOKEN` secret. The user set up trusted publishing for every package, the re-run published all 21 packages with provenance, and the release workflow no longer uses a token (decision-56).
- **Positioning:** decision-74, with the new hero (TASK-483), Astro's row relabelled (TASK-482), the Coming from Astro guide (TASK-481) and a public scorecards page (TASK-494).
