---
id: TASK-142
title: >-
  Strict CSP: inline style sources the policy refuses (static style attributes,
  <style> in <svg>, content imports)
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-09 05:12'
labels:
  - security
  - css
  - compiler
dependencies: []
priority: low
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-138. Under lumen({ csp: "strict" }) (no 'unsafe-inline' for styles) three sources still produce inline styles the browser refuses: (1) style="…" written as a plain string, which the compiler folds into static template HTML (client templates and server static parts), (2) <style> inside <svg> in .stsx (kept as native SVG CSS; spa-chiptune's PixelLogo hit this and moved its CSS to a file-level block), (3) style attributes or <svg><style> inside .md/.html imports. Options: compile static style attributes through styleAttr/setStyle when the project is strict (needs a compile option), lift <svg><style> into the file's block, and/or a warning diagnostic (LUM3xxx) for each source when csp is strict, plus the LS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each source either works under strict CSP or gets a diagnostic with a fix; docs/concepts/security.md updated
<!-- AC:END -->
