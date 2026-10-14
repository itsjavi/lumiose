# @lumiose/compiler

The [Lumiose](https://itsjavi.com/lumiose/) compiler, written in Rust: native bindings through
napi-rs, with a WebAssembly (WASI) fallback for platforms without a native binary.

`@lumiose/vite` and `@lumiose/cli` depend on it, so apps do not install or import it directly. The
binary for your platform comes as an optional dependency (`@lumiose/compiler-<platform>`). How it
compiles `.stsx` and `.tsx`, and its `LUMxxxx` diagnostics:
[Compiler and diagnostics](https://itsjavi.com/lumiose/docs/concepts/compiler/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
