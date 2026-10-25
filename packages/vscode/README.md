# Lumiose for VS Code

Language support for Lumiose `.stsx` files (TSX plus raw-CSS `<style>` blocks):

- the `stsx` language: TSX highlighting with embedded CSS and `$name` reference highlighting,
  and `<style>` auto-closing;
- the Lumiose language server: TypeScript 7 features in `.ts`, `.tsx` and `.stsx` (takeover mode),
  CSS features inside `<style>` blocks and in the outline, `$name` hovers and Lumiose diagnostics
  (scanner and compiler). A crashed TypeScript server is restarted automatically.

## Install

Lumiose releases after 0.8.0 publish the extension as `lumiose.lumiose-vscode`, with the version of
the other Lumiose packages:

- VS Code: search for **Lumiose** in the Extensions view, or run
  `code --install-extension lumiose.lumiose-vscode` (VS Code Marketplace);
- Cursor, VSCodium and other forks: the same, from Open VSX;
- any of them: download the `.vsix` of your platform from the
  [GitHub release](https://github.com/itsjavi/lumiose/releases) and run **Extensions: Install from
  VSIX…** from the command palette.

Until then, or to try unreleased changes, see Installing a local build.

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
  binary for the machine it runs on. The release workflow packages every target on one runner,
  with the binaries the Binaries workflow builds on each platform (see Releases).
- There is no Alpine (musl), Windows on Arm or web build. On those platforms VS Code installs no
  Lumiose package with a server; a project can still install `@lumiose/language-server` (with its
  own compiler build) and point `lumiose.server.path` at it.
- The compiler's WebAssembly fallback is not bundled.

## Installing a local build

In a clone of the repository (Node.js 24, pnpm and Rust through rustup, which
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
pnpm --filter lumiose-vscode run package --all          # every target; needs every compiler binary
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

## Releases

The extension has the version of the other Lumiose packages (decision-89): `pnpm release:version`
bumps it, and pushing the `v<x.y.z>` tag runs `.github/workflows/release.yml`:

- the `vscode` job packages the `.vsix` of every target in Platforms (`node scripts/package.ts --all`)
  with the compiler binaries of the Binaries workflow;
- `github-release` attaches them to the tag's GitHub release;
- `vscode-marketplace` and `vscode-open-vsx` publish them, after npm, on real releases
  (`LUMIOSE_PUBLISH`) of `x.y.z` versions. Pre-release versions (`x.y.z-*`) are only on the GitHub
  release: the Marketplace takes no such versions, and never publishes a version twice.

A manual run of the workflow, or one without `LUMIOSE_PUBLISH`, packages the files and publishes
nothing.

### One-time setup

**VS Code Marketplace** (publisher `lumiose`). Azure DevOps global personal access tokens can no
longer be created and stop working on 2026-12-01, so the job signs in with Microsoft Entra ID,
without a secret
([Microsoft's steps](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)):

1. In Microsoft Entra ID (Azure portal), register an application, or create a user-assigned managed
   identity.
2. Add a federated credential to it: issuer `https://token.actions.githubusercontent.com`, subject
   `repo:itsjavi/lumiose:environment:vscode-marketplace`, audience `api://AzureADTokenExchange`.
3. Add it to the `lumiose` publisher as a Contributor, as Microsoft's steps describe.
4. Set the repository variables `VSCE_AZURE_CLIENT_ID` (its application or client ID) and
   `VSCE_AZURE_TENANT_ID`. The job's `vscode-marketplace` environment is created on the first run;
   its settings can limit it to `v*` tags.

Without the variables the job only warns. A publisher owned by a personal account may be refused
with "corporate credentials required" (microsoft/vscode-vsce#1023). In both cases, upload the
GitHub release's `.vsix` files by hand: open the extension on the publisher's management page and
update it with each file.

**Open VSX** (namespace `lumiose`), for Cursor, VSCodium and other forks:

1. Sign in to open-vsx.org with GitHub, link an Eclipse account and sign the Publisher Agreement.
2. Create an access token, then the namespace: `npx ovsx create-namespace lumiose -p <token>`.
   Claim it on the Namespace Access page to show it as verified.
3. Store the token as the repository secret `OVSX_PAT` for the first release.
4. Once a version is on Open VSX, register a trusted publisher (Settings, Trusted Publishers:
   GitHub Actions, `itsjavi`/`lumiose`, workflow `release.yml`). Then delete `OVSX_PAT` and the
   token: a token takes precedence over trusted publishing.
