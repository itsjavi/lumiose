# Lumiose for VS Code

Language support for Lumiose `.stsx` files (TSX plus raw-CSS `<style>` blocks):

- the `stsx` language: TSX highlighting with embedded CSS and `$name` reference highlighting,
  and `<style>` auto-closing;
- the Lumiose language server: TypeScript 7 features in `.ts`, `.tsx` and `.stsx` (takeover mode),
  CSS features inside `<style>` blocks and in the outline, `$name` hovers and Lumiose diagnostics
  (scanner and compiler). A crashed TypeScript server is restarted automatically.

## Editor features

| Where                    | What you get                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class="…"`, `class={…}` | Classes of the blocks that apply there, by placement: the enclosing elements' nested blocks (innermost first, never a sibling subtree's), the file's blocks, then the project's global classes (`<style global>` in any file, and global `.css` files imported by its modules). Go to definition and rename follow the same scopes. |
| `var(--…)`, `--name: …`  | Every custom property declared in the project (any `<style>` block or imported `.css`), the file's own first, with its declared value as the detail and every declaration in the documentation.                                                                                                                                     |
| `<style …>`              | `global`, its only attribute, with a description; hovers on `style` and `global` describe the block's scope.                                                                                                                                                                                                                        |
| Lumiose attributes       | Descriptions in hovers and completion for `client:load`, `client:idle`, `client:visible`, `client:media`, `client:only`, `bind:value`, `bind:checked`, `on:event`, `attach`, `ref` and `key`.                                                                                                                                       |
| Snippets                 | `comp`, `acomp` and `route` at a top-level statement start; `island` in JSX children. They come from the server, so they never show up inside tags, strings, `<style>` tags or blocks.                                                                                                                                              |

## Which language server runs

The extension looks for the server in this order:

1. `lumiose.server.path`, when set (absolute, or relative to the first workspace folder);
2. `@lumiose/language-server` installed in the workspace (directly, or next to its `lumiose`
   package), so a project can pin the server that matches its `lumiose` version;
3. the server bundled with the extension (`server/bin.mjs`), so a Lumiose project gets editor
   features without installing anything else.

The **Lumiose Language Server** output channel logs which one started, and with which runtime.

## Runtime

| Server                             | Runs on (default)                                   | Needs                                                                                |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Bundled (`server/bin.mjs`)         | VS Code's own Node.js (its executable, run as Node) | nothing: plain JavaScript, built with Rolldown                                       |
| Workspace or `lumiose.server.path` | `node` from `PATH`                                  | Node.js ≥ 24: the package runs from TypeScript sources through Node's type stripping |

Set `lumiose.server.runtime` to a Node.js executable to run every server with it instead.

Every server uses the **project's TypeScript 7** (`typescript@^7`, a native binary) for type
features; the bundled server does not ship TypeScript. Without it, `.stsx` files keep CSS features
and highlighting, and the output channel says how to install it.

## Platforms

The bundled server loads the native Lumiose compiler (`@lumiose/compiler`, a napi-rs binary), so the
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
  Lumiose package with a server; a project can still install `@lumiose/language-server` (with its
  own compiler build) and point `lumiose.server.path` at it.
- The compiler's WebAssembly fallback is not bundled.

## Installing a local build

The extension is not published to the VS Code Marketplace or Open VSX yet, so this is the only way
to install it. In a clone of the repository (Node.js 24, pnpm and Rust through rustup, which
installs the version in `rust-toolchain.toml`), build the native compiler and package the extension
for this machine, then install the `.vsix` over any previous Lumiose build (`--force` replaces it
even though the version is unchanged):

```sh
pnpm install
pnpm build:compiler                          # packages/compiler/compiler.<platform>.node
pnpm --filter lumiose-vscode run package       # packages/vscode/lumiose-vscode-<target>.vsix
code --install-extension packages/vscode/lumiose-vscode-darwin-arm64.vsix --force
```

Use the `.vsix` of your platform (`lumiose-vscode-linux-x64.vsix`, …; see Platforms). In Cursor,
VSCodium and other forks, run **Extensions: Install from VSIX…** from the command palette instead
of `code`. Then run
**Developer: Reload Window** in every open VS Code window. To check what runs, open the **Lumiose
Language Server** output channel: it logs the server's path and source (`bundled`, `workspace` or
`setting`). In this repository, a workspace with `@lumiose/language-server` installed uses the
repository's server from its TypeScript sources (see Which language server runs): after a server
change, **Lumiose: Restart Language Server** picks it up without reinstalling. If an older install
misbehaves, remove it first with `code --uninstall-extension lumiose.lumiose-vscode`.

## Building

```sh
pnpm --filter lumiose-vscode run build                  # dist/ and server/ for this platform
pnpm --filter lumiose-vscode run package                # lumiose-vscode-<target>.vsix for this platform
pnpm --filter lumiose-vscode run package --target linux-x64  # needs packages/compiler/compiler.linux-x64-gnu.node
pnpm --filter lumiose-vscode run test:vscode            # smoke test in a real VS Code, both server modes
```

`test:vscode` packages the extension, then runs the smoke suite twice in an isolated VS Code: with
`@lumiose/language-server` installed in the workspace, and without it (the bundled server on VS
Code's Node.js). `--mode=workspace` or `--mode=bundled` runs one of them.

## Settings

| Setting                  | Default  | Meaning                                                                                                 |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `lumiose.takeover`       | `prompt` | Serve `.ts`/`.tsx`/`.js`/`.jsx` too when the built-in TypeScript extension is disabled (`auto`, `off`). |
| `lumiose.server.path`    | empty    | A language server entry to run instead of the workspace or bundled one.                                 |
| `lumiose.server.runtime` | empty    | The Node.js executable for the server (see Runtime).                                                    |
| `lumiose.trace.server`   | `off`    | Trace the client-server messages.                                                                       |
