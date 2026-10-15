# Custom Elements Everywhere: Lumiose

Lumiose's implementation of the [Custom Elements Everywhere](https://custom-elements-everywhere.com)
tests (TASK-326, decision-54), run in Chromium, Firefox and WebKit with Playwright.

| Engines                     | Score | Basic | Advanced |
| --------------------------- | ----- | ----- | -------- |
| Chrome and Firefox (scored) | 100   | 16/16 | 16/16    |
| WebKit                      | 100   | 8/8   | 8/8      |

Before TASK-326 the score was 83: arrays, objects and camelCase names reached the elements as
attributes. The rule Lumiose follows and how to use web components are in the
[Web components guide](../../packages/lumiose/docs/guides/web-components.md).

## Run

```sh
pnpm --filter @lumiose/bench-cee test:e2e
```

It builds the test page with Vite and `@lumiose/vite`, runs it in the three engines
(`pnpm exec playwright install` once for the browsers), writes `results/<engine>.json`, and scores
them into `results/summary.json` with upstream's formula: the weighted share of passing tests over
Chrome and Firefox. Every test must pass, so a regression fails the run.

## Layout

The files mirror a library folder upstream (`libraries/<name>`), so that they can be submitted
there (opening that pull request is the user's call):

- `src/components.tsx`: the components under test, Lumiose's counterpart of `src/components.js`.
- `src/basic-tests.tsx`, `src/advanced-tests.tsx`: upstream's suites with their assertions and
  weights; elements are found by id, and `flush()` applies pending updates where React's suite
  calls `act()`.
- `fixtures/webcomponents/`: upstream's shared custom elements, unchanged.
- `src/mocha.ts`, `src/chai.ts`: the parts of mocha and chai the suites use, so the page runs
  without Karma; upstream runs the same suites with Karma, mocha and chai.

Upstream revision: `2e5eea092362ba9327bb285722bc72bd009d922a` (2025-08-10). The files in
`fixtures/webcomponents/` and the suites' assertions are Copyright 2017 Google Inc., under the Apache
License 2.0 (see their headers); the rest is MIT.
