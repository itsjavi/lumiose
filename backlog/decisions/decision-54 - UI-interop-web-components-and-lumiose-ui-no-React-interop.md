---
id: decision-54
title: 'UI interop: web components and @lumiose/ui, no React interop'
date: '2026-10-15 04:01'
status: accepted
---
## Context

The first objection of a React developer: "I can't use Radix, shadcn, TanStack Table, react-hook-form or my design system." Options considered: no interop; an opt-in `@lumiose/react` that renders React components as islands (Astro's approach, React's runtime paid where used); a `preact/compat`-like layer. For accessible primitives, research compared a Zag.js adapter with Ark-style components (mature, 6 to 27 kB gzip per component, every component hydrates, no native top layer), a port of Base UI (about 2.6 MB of React-hook code, fast upstream), Timeless (timeless.build, the user's own project: native-first custom elements in the light DOM and CSS over native HTML, no hydration, young at 0.2.0), and an own build on native features plus Floating UI. Agreed with the user in a grilling session on 2026-10-15.

## Decision

User decision, 2026-10-15.

- **No React interop**: no React islands package and no compat layer. One component model stays the pitch (decision-37); depending on the React ecosystem is listed on the "When not to use Lumiose" page.
- **Web components are the interop path.** Lumiose runs the Custom Elements Everywhere suite, fixes the gaps, publishes the score and documents using web-component libraries.
- **`@lumiose/ui`** provides accessible primitives (dialog, popover, menu, combobox, select, tabs, tooltip and more), following Timeless: native platform first, server-rendered without hydration, zero JavaScript for CSS-only parts. Base UI's part anatomy and data attributes inspire the API; Zag.js is considered later for widgets Timeless lacks (date picker, tree view).
- **Whether to depend on, port or merge Timeless** is decided by a spike that prototypes dialog, menu and combobox (TASK-332), as a proposal to the user.
- **Versioning:** @lumiose/ui keeps its own 0.x versions outside lockstep until its own 1.0; Lumiose's API freeze covers it from then.
- **Planning:** its own milestone, M12, started after M10.

## Consequences

- The release script supports a package outside lockstep (TASK-333).
- TASK-326 covers Custom Elements Everywhere and the web components guide.
- @lumiose/ui is measured outside the runtime size cap (decision-55).
