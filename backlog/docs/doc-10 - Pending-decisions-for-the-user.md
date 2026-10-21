---
id: doc-10
title: Pending decisions for the user
type: other
created_date: '2026-10-16 22:28'
updated_date: '2026-10-21 02:01'
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

### P0. Renew the npm token, then re-run the 0.5.0 publish (TASK-485)

- **Waiting:** the Release workflow for v0.5.0 built every binary and packed every package, but the first `npm publish` got E404 on PUT, which is what an expired or under-privileged `NPM_TOKEN` secret returns. Nothing was published.
- **The user:** create a new npm token with publish rights for `lumiose`, `create-lumiose` and `@lumiose/*` (or set up trusted publishing for each), store it as the repository's `NPM_TOKEN` secret, then re-run the failed `publish` job of the v0.5.0 Release run, or ask Lux to (a re-run costs CI minutes).
- **Meanwhile:** the itsjavi.com re-score (TASK-486), the dotmatrix install (TASK-488) and the private-app port (TASK-492) wait for 0.5.0 on npm.

### P1. Push main to origin

- **Pushed on 2026-10-21** with the user's approval: main at 13be67c4 and the tag v0.5.0 (21 commits after 3d17ea32). The history below is kept for reference until the next push.
- **Waiting:** local commits after 4bfc013a (the last push, which the user approved on 2026-10-16). Pushing runs CI, which costs money, so every push needs the user's OK (AGENTS.md).
- **Recommendation:** push now, in one push. The checks on local main were green on 2026-10-17: pnpm check, cargo fmt and clippy, ui-e2e (Chromium 1018; Firefox and WebKit 1030), apps/web (179), pack smoke and nine example suites.
- **Meanwhile:** commits stay local. Lux keeps the list of what each push would carry under this item.
- **What the push carries (58 commits after 4bfc013a, at 45486aba plus backlog):**
  - the final M12 follow-ups (TASK-458 to TASK-465);
  - Photon's compiler and packaging fixes (TASK-347, 348, 349, 289 and 466; decision-67);
  - Nova's shared route-group CSS (TASK-285; decision-68) and parallel precompression (TASK-288);
  - the security review's fixes (TASK-468 to TASK-476 and TASK-479 to TASK-480; decision-69);
  - the static-file handle leak (TASK-476);
  - TASK-477 (spread objects in @lumiose/ui follow their props) and TASK-478 (a written innerHTML or textContent next to a spread).
- **Checks at 45486aba (2026-10-17):** all green: pnpm check, cargo fmt and clippy, ui-e2e (Chromium 1018; Firefox and WebKit 1030), apps/web 179, pack smoke and nine example suites.

### P2. The screen reader pass (TASK-361)

- **Waiting:** the user, who chose on 2026-10-16 to run VoiceOver and NVDA themselves. The per-component checklist is in TASK-361's notes. It also covers Prism's M23 (the announcements of Combobox's Empty and Status).
- **Meanwhile:** nothing blocks on it except publishing (P3).

### P3. Publish @lumiose/ui 0.1.0 (TASK-389)

- **Waiting:** the user's go. Publishing and tagging always need explicit permission (AGENTS.md).
- **Order the user chose on 2026-10-16:**
  1. Prism's review (done, TASK-386);
  2. the screen reader pass (P2);
  3. then publishing.
- **Recommendation:** publish 0.1.0 after P2. Run `pnpm release:version 0.1.0 --package @lumiose/ui` once the pre-release security review (see P4) shows no open High finding.
- **Meanwhile:** Lux prepares the release: the security review, the changelog and the package checks. Lux doesn't tag or publish.

### P4. The security review before the first @lumiose/ui release

- **Not a question:** listed so that the user sees it.
- AGENTS.md asks for an app-security-review before each lumiose minor release. TASK-430 changed form actions (lumiose's action data now carries `FormData`), so Lux runs that review unattended before P3 and records its findings as tasks.
- **Status (2026-10-17): done.** Prism found 1 High, 3 Medium and 14 Low (TASK-468 to TASK-475). All are fixed and merged, and the merged checks pass. No High is open, so P3 waits only on P2 and the user's go. Two items need the user's call: P13.

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

## Answered

### 2026-10-20: what Lumiose is for (grilling session)

- **Purpose, evidence and focus:** decision-70, with milestone M13 and the scorecards in doc-11.
- **TASK-283 (small client scripts, from P8):** decision-71. `?client` is the only mechanism, and data goes through attributes.
- **Repository root:** decision-72.
- **Extracting the chiptune apps and gbapu:** decision-73.
- **Positioning:** decision-74, with the new hero (TASK-483), Astro's row relabelled (TASK-482), the Coming from Astro guide (TASK-481) and a public scorecards page (TASK-494).
