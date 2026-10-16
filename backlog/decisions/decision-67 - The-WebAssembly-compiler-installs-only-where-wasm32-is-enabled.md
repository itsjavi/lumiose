---
id: decision-67
title: The WebAssembly compiler installs only where wasm32 is enabled
date: '2026-10-16 22:54'
status: accepted
---
## Context

`@lumiose/compiler` lists every platform package as an optional dependency. The native ones declare `os` and `cpu` (through `publishConfig`), so package managers install only the one that matches. `@lumiose/compiler-wasm32-wasi` (11.4 MB) declared neither, so every install got it next to its native binary (TASK-289, found in the itsjavi.com port).

How napi-rs projects handle it (checked 2026-10-17):

- **`cpu: ["wasm32"]` on the WASI package.** The napi-rs WebAssembly docs prescribe it: package managers skip the package unless `wasm32` is an enabled architecture, set with `supportedArchitectures: { cpu: [current, wasm32] }` (pnpm, Yarn 4) or `npm install --cpu=wasm32`. The WASI packages of oxc (parser, transform, minify, resolver), Tailwind's oxide and Astro's compiler binding declare it (the workspace lockfile shows them).
- **No constraint.** napi-rs CLI 3.10's own release check requires WASI packages to omit `cpu` and `os` "so WASI can run on any host architecture", and Solid's compiler ships that way. That is the current Lumiose behaviour, the one this task removes.
- **A separate package installed by hand** (`esbuild-wasm`, `lightningcss-wasm`, `@parcel/watcher-wasm`): the main package never depends on it.
- **`os`/`cpu` negations** (`"cpu": ["!x64"]`) cannot express "every (os, cpu) pair without a native binary": `["!x64", "!arm64"]` would also skip Windows on Arm, which has no native binary and needs the fallback.

## Decision

Photon's decision (2026-10-17), delegated by TASK-289. The WASI package declares `cpu: ["wasm32"]` in its `publishConfig`, like the native packages declare theirs, so the workspace still links it for the WASI tests and the published manifest carries it. It stays an optional dependency of `@lumiose/compiler`, and the loader is unchanged: where it is installed, the compiler falls back to it as before.

`scripts/pack.ts` rejects a WASI tarball without `cpu: ["wasm32"]`. The getting-started page, the compiler README and the WASI package README say how to enable `wasm32`.

Why this one: it is what napi-rs documents and what the napi-rs packages Lumiose already depends on (oxc, through Vite) do, it keeps the automatic fallback through the loader, and it needs no new packages. A hand-installed package would fail the same users with a less helpful setup: a regular dependency on a package whose `cpu` does not match is an install error.

## Consequences

- An install on macOS, Linux x64/arm64 (glibc or musl) or Windows x64 no longer downloads 11.4 MB it never loads. Checked on darwin-arm64 with pnpm 11 and npm 11: the native package alone by default; both with pnpm's `supportedArchitectures`; the WASI package alone with npm's `cpu=wasm32`.
- Platforms without a native binary (Windows on Arm, FreeBSD, linux-riscv64, 32-bit ARM, WebContainers) must enable `wasm32` before installing. Without it, loading `@lumiose/compiler` fails with napi-rs's "Cannot find native binding" error. A native `win32-arm64-msvc` binary would remove the step for the largest of those audiences; it costs one more Binaries job per release, so it waits for the user.
- The playground is unaffected: it runs `crates/lumiose_wasm` (wasm-bindgen), not this package.
