# Requirements

> What Lumiose needs to run: Node.js 24, TypeScript 7, Vite 8, and a platform with a native compiler or the WebAssembly fallback.

## Tools

| Tool       | Version                                                                |
| ---------- | ---------------------------------------------------------------------- |
| Node.js    | 24 or later.                                                           |
| TypeScript | `typescript@^7`. Lumiose uses stock `tsc`, with no TypeScript plugins. |
| Vite       | 8.                                                                     |

Supported Node.js versions and browsers over time: [Stability](stability.md).

## Platforms

The compiler runs natively on:

- macOS (arm64, x64)
- Linux (x64, arm64; glibc or musl)
- Windows x64

Elsewhere (Windows on Arm, FreeBSD, other CPUs) it runs as WebAssembly.

## WebAssembly fallback

Package managers install the WebAssembly compiler only when you enable the `wasm32` architecture.
Enable it before you install.

```yaml
# pnpm-workspace.yaml (pnpm), or .yarnrc.yml (Yarn 4)
supportedArchitectures:
  cpu:
    - current
    - wasm32
```

With npm, add `cpu=wasm32` to the project's `.npmrc` (or run `npm install --cpu=wasm32`).

Next: [Getting started](getting-started.md).
