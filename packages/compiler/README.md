# @lumiose/compiler

The [Lumiose](https://lumiose.dev/) compiler, written in Rust: native bindings through
napi-rs, with a WebAssembly (WASI) fallback for platforms without a native binary.

`@lumiose/vite`, `@lumiose/stsx` and `@lumiose/cli` depend on it, so apps do not install or import
it directly. `compile()` produces Lumiose modules; `compileTsx()` produces the TSX and CSS of a
`.stsx` file for another JSX framework (React, Preact, Solid), which `@lumiose/stsx` uses. The
binary for your platform comes as an optional dependency (`@lumiose/compiler-<platform>`). How it
compiles `.stsx` and `.tsx`, and its `LUMxxxx` diagnostics:
[Compiler and diagnostics](https://lumiose.dev/docs/concepts/compiler/).

Native binaries cover macOS (arm64, x64), Linux (x64, arm64; glibc and musl) and Windows x64.
Elsewhere the compiler loads `@lumiose/compiler-wasm32-wasi`, which declares `cpu: ["wasm32"]` so
that installs with a native binary skip it. Enable `wasm32` to install it: `supportedArchitectures:
{ cpu: [current, wasm32] }` in `pnpm-workspace.yaml` (pnpm) or `.yarnrc.yml` (Yarn 4), or
`cpu=wasm32` in `.npmrc` (npm).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
