# Lumen for VS Code

Language support for Lumen `.stsx` files (TSX plus raw-CSS `<style>` blocks):

- the `stsx` language: TSX highlighting with embedded CSS and `$name` reference highlighting,
  snippets, and `<style>` auto-closing;
- the Lumen language server: TypeScript 7 features in `.ts`, `.tsx` and `.stsx` (takeover mode),
  CSS features inside `<style>` blocks, class completion, `$name` hovers and Lumen diagnostics.

## Which language server runs

The extension looks for the server in this order:

1. `lumen.server.path`, when set (absolute, or relative to the first workspace folder);
2. `@lumen/language-server` installed in the workspace (directly, or next to its `lumen`
   package), so a project can pin the server that matches its `lumen` version;
3. the server bundled with the extension (`server/bin.mjs`), so a Lumen project gets editor
   features without installing anything else.

The **Lumen Language Server** output channel logs which one started, and with which runtime.

## Runtime

| Server                           | Runs on (default)                                   | Needs                                                                                |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Bundled (`server/bin.mjs`)       | VS Code's own Node.js (its executable, run as Node) | nothing: plain JavaScript, built with Rolldown                                       |
| Workspace or `lumen.server.path` | `node` from `PATH`                                  | Node.js ≥ 24: the package runs from TypeScript sources through Node's type stripping |

Set `lumen.server.runtime` to a Node.js executable to run every server with it instead.

Every server uses the **project's TypeScript 7** (`typescript@^7`, a native binary) for type
features; the bundled server does not ship TypeScript. Without it, `.stsx` files keep CSS features
and highlighting, and the output channel says how to install it.

## Platforms

The bundled server loads the native Lumen compiler (`@lumen/compiler`, a napi-rs binary), so the
extension is published as **platform-specific packages**, one `.vsix` per target, each with that
platform's `compiler.<platform>.node` next to `server/bin.mjs`:

| VS Code target | Compiler binary                 |
| -------------- | ------------------------------- |
| `darwin-arm64` | `compiler.darwin-arm64.node`    |
| `darwin-x64`   | `compiler.darwin-x64.node`      |
| `linux-x64`    | `compiler.linux-x64-gnu.node`   |
| `linux-arm64`  | `compiler.linux-arm64-gnu.node` |
| `win32-x64`    | `compiler.win32-x64-msvc.node`  |

Limits:

- A target can only be packaged where its compiler binary exists: `pnpm build:compiler` builds the
  binary for the machine it runs on, so release packaging runs on one CI runner per target (or
  cross-compiles the binaries first).
- There is no Alpine (musl), Windows on Arm or web build. On those platforms VS Code installs no
  Lumen package with a server; a project can still install `@lumen/language-server` (with its
  own compiler build) and point `lumen.server.path` at it.
- The compiler's WebAssembly fallback is not bundled.

## Building

```sh
pnpm --filter lumen-vscode run build                  # dist/ and server/ for this platform
pnpm --filter lumen-vscode run package                # lumen-vscode-<target>.vsix for this platform
pnpm --filter lumen-vscode run package --target linux-x64  # needs packages/compiler/compiler.linux-x64-gnu.node
pnpm --filter lumen-vscode run test:vscode            # smoke test in a real VS Code, both server modes
```

`test:vscode` packages the extension, then runs the smoke suite twice in an isolated VS Code: with
`@lumen/language-server` installed in the workspace, and without it (the bundled server on VS
Code's Node.js). `--mode=workspace` or `--mode=bundled` runs one of them.

## Settings

| Setting                | Default  | Meaning                                                                                                 |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `lumen.takeover`       | `prompt` | Serve `.ts`/`.tsx`/`.js`/`.jsx` too when the built-in TypeScript extension is disabled (`auto`, `off`). |
| `lumen.server.path`    | empty    | A language server entry to run instead of the workspace or bundled one.                                 |
| `lumen.server.runtime` | empty    | The Node.js executable for the server (see Runtime).                                                    |
| `lumen.trace.server`   | `off`    | Trace the client-server messages.                                                                       |
