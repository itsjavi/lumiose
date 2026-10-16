---
id: decision-69
title: Imported SVG icons drop external references
date: '2026-10-16 23:47'
status: accepted
---
## Context

Prism's pre-release security review (decision-56, 2026-10-17, finding L2) showed that an `.svg` imported as a component keeps its external references:
- `href` with http(s) or data on `<use>`, `<image>` and `<feImage>`;
- `@import` and `url()` with an external target in `<style>`.

A third-party icon set can therefore make every page that shows an icon request an outside host, which tracks the page's viewers. No script runs, but `concepts/svg.md` and `concepts/security.md` present imported icons as inert.

## Decision

Orchestrator decision (Lux, 2026-10-17). It is a security default with no new syntax or option.
- The SVG sanitizer drops those external references from imported icons.
- It keeps fragment references (`#id`), which icons use for gradients, masks, clip paths and symbols.
- An app that really needs an external image in an SVG can still render the `<svg>` markup itself in a component, or use an `<img>` that points at the file.

## Consequences

- TASK-474 implements it in `crates/lumiose_svg` with tests, and documents it in svg.md and security.md.
- Icons that relied on external references stop loading them. Lux knows of none, and the docs name the alternatives.
