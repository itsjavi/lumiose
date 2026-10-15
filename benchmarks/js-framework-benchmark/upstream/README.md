# Lumiose for krausest/js-framework-benchmark

`frameworks/keyed/lumiose` is the entry prepared for
[krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) (TASK-316,
decision-55), in its layout. It builds with the published packages (`lumiose`, `@lumiose/vite` and
`vite` at fixed versions, an npm `package-lock.json`), and its app is this package's
`src/App.stsx` and `src/main.tsx`, copied in when the entry is assembled, so the measured app and
the submitted one stay the same.

## Check it

```sh
pnpm --filter @lumiose/bench-jsfb bench:jsfb:upstream
```

It checks out the pinned krausest commit into `.krausest-upstream/`, assembles the entry and runs
krausest's own `npm run rebuild-ci keyed/lumiose`: `npm ci`, `npm run build-prod`, a smoke run of
every benchmark, `isKeyed` and `checkCSP`. Last run (2026-10-15, krausest `bf894b6`,
`lumiose@0.4.0`): all checks pass, and the entry is keyed for the run, remove and swap
benchmarks.

## Upstream rules it follows

- The vanillajs HTML, with the `aria-hidden` attributes and the preloaded glyphicon.
- Keyed: rows keep their identity (`isKeyed` passes).
- The selection is one id in state, not a flag per row (note #800).
- No explicit event delegation (note #801): handlers are `onClick` props; delegating them is the
  framework's own behaviour.
- No manual DOM work (note #772) and no `requestAnimationFrame` (note #796) in app code.
- Fixed dependency versions, `npm ci` and `npm run build-prod`, output in `dist/main.js`.

## Submit it

Opening the pull request is outward-facing, so it waits for the user's approval. Then:

1. Release the Lumiose version to submit, and bump `lumiose` and `@lumiose/vite` in
   `frameworks/keyed/lumiose/package.json`.
2. `pnpm --filter @lumiose/bench-jsfb bench:jsfb:upstream --lock --export <krausest>/frameworks/keyed`
   refreshes the lockfile, checks the entry and copies it into a krausest fork.
3. Open the pull request with only that folder. krausest runs the benchmarks and publishes the
   results; link them from the site once they appear.
