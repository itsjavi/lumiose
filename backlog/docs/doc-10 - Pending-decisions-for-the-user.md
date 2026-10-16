---
id: doc-10
title: Pending decisions for the user
type: other
created_date: '2026-10-16 22:28'
updated_date: '2026-10-16 22:28'
---
Decisions that need the user, collected while Lux and the workers run unattended (user request, 2026-10-17: "do not block yourself on more questions … postpone them (and their decisions) in a document that can be used later as follow ups").

Each item has:
- what is waiting;
- the options;
- Lux's recommendation;
- what happens meanwhile.

Nothing here is decided until the user answers. Answered items move to the Answered section with the date, and are recorded in the decision or task they belong to.

## Open

### P1. Push main to origin

- **Waiting:** local commits after 4bfc013a (the last push, which the user approved on 2026-10-16). Pushing runs CI, which costs money, so every push needs the user's OK (AGENTS.md).
- **Recommendation:** push once the final M12 batch (TASK-458 to TASK-465) is merged and green, in one push.
- **Meanwhile:** commits stay local. Lux keeps the list of what each push would carry under this item.

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
- TASK-283: small client scripts without the island runtime.
- TASK-286: an option to skip precompressed copies in static builds.
- TASK-287: sitemap and redirects options for static sites.

### P9. Agent eval runs (TASK-185, 207, 208, 209, 243)

- **Waiting:** evals cost money, so they never run without the user's permission (AGENTS.md).
- **Recommendation:** TASK-207 (three repeats per frontier model) first. TASK-243's /evals page depends on its results.
- **Meanwhile:** eval files can be edited, but nothing runs.

### P10. External security review before 1.0 (TASK-310)

- **Waiting:** the user, to choose and engage an external reviewer.
- **Meanwhile:** the internal pre-release review (P4) still runs.

### Blocked upstream (no decision needed)

- **TASK-64:** waits for a Lightning CSS release after 1.33.0 that includes PR #1329. It was still 1.33.0 on 2026-10-17.
- **TASK-264:** waits for the arm64 musl compiler package on npm, which comes with the next lumiose release.

## Answered
