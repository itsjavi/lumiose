# `@lumiose/compiler-wasm32-wasi`

This is the **wasm32-wasip1-threads** binary for `@lumiose/compiler`.

It declares `cpu: ["wasm32"]`, so package managers skip it where a native binary exists. On a
platform without one, enable `wasm32` before installing: `supportedArchitectures: { cpu: [current,
wasm32] }` in `pnpm-workspace.yaml` (pnpm) or `.yarnrc.yml` (Yarn 4), or `cpu=wasm32` in `.npmrc`
(npm).
