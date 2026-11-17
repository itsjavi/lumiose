# Editors: VS Code, Neovim, Helix and Zed

> Install the Lumiose VS Code extension, run the Lumiose language server in Neovim and Helix (file type, root markers, the server command), what works in Zed today, and how GitHub highlights `.stsx` files.

## VS Code

```sh
code --install-extension lumiose.lumiose-vscode
```

Or search for **Lumiose** (`lumiose.lumiose-vscode`) in the Extensions view. The extension adds
the `stsx` language and bundles the Lumiose language server, which every editor runs
([what it adds](#what-the-server-adds)). It starts in workspaces with `.stsx` files or the
`lumiose` package, and:

- **Needs the project's TypeScript 7** (`typescript@^7`) for type features; without it, `.stsx`
  files keep highlighting and CSS features, and the **Lumiose Language Server** output channel says
  how to install it.
- **Runs the server bundled with it**, on VS Code's own Node.js, unless the project has
  `@lumiose/language-server` installed: then it runs that one. Install it as a dev dependency
  only to pin the server to your `lumiose` version.
- **Serves `.ts` and `.tsx` files too** ("takeover", so types flow between them and `.stsx` files)
  once VS Code's built-in TypeScript extension is disabled for the workspace. It offers to do that
  in Lumiose projects; **Lumiose: Set Up Takeover Mode** shows the steps (in the Extensions view,
  **TypeScript and JavaScript Language Features**, **Disable (Workspace)**, then reload the window).
  With `lumiose.takeover` set to `off`, it serves `.stsx` files only.

**Lumiose: Restart Language Server** restarts it, and the extension's
[README](https://github.com/itsjavi/lumiose/tree/main/packages/vscode#readme) lists its settings
and how to build it from source.

> **Forks:** in Cursor, VSCodium and other forks, download the `.vsix` file of your platform
> (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64` or `win32-x64`) from the
> [latest GitHub release](https://github.com/itsjavi/lumiose/releases/latest) and run
> **Extensions: Install from VSIX…** from the command palette.

## Set up the server

```sh
pnpm add -D @lumiose/language-server
```

Editors other than VS Code start the server over the Language Server Protocol, from the project,
so it matches your `lumiose` version. Each needs the same four things:

| Setting      | Value                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| Command      | `npx --no-install lumiose-language-server --stdio`, run in the project (Node.js 24 or later). |
| Files        | `.stsx` (a file type of its own), `.ts` and `.tsx`.                                           |
| Root markers | `vite.config.ts`, then `package.json`.                                                        |
| Highlighting | The TSX grammar for `.stsx`: the editor colors the TSX, and the server adds the rest.         |

The server proxies TypeScript 7 for `.ts` and `.tsx` files too ("takeover"), so types, renames and
go-to-definition flow between them and `.stsx` files. Disable the editor's own TypeScript server
(`ts_ls`, `vtsls`, `typescript-language-server`) for Lumiose projects; with two servers, `.tsx`
files would get every diagnostic twice.

## Neovim

Neovim 0.11 or later, with the built-in LSP client. In `init.lua` (or a file under `plugin/`):

```lua
-- .stsx files: TSX with <style> blocks.
vim.filetype.add({ extension = { stsx = "stsx" } })
-- Color them with the TSX tree-sitter parser (nvim-treesitter's "tsx").
vim.treesitter.language.register("tsx", "stsx")

vim.lsp.config("lumiose", {
  -- The project's own server, started in the project root.
  cmd = function(dispatchers, config)
    return vim.lsp.rpc.start(
      { "npx", "--no-install", "lumiose-language-server", "--stdio" },
      dispatchers,
      { cwd = config.root_dir }
    )
  end,
  filetypes = { "typescript", "typescriptreact", "stsx" },
  root_markers = { "vite.config.ts", "package.json" },
})
vim.lsp.enable("lumiose")
```

> **Check:** `:checkhealth vim.lsp` shows the attached client. Do not enable `ts_ls` or `vtsls`
> for the same projects (with nvim-lspconfig, leave them out of `vim.lsp.enable`).

## Helix

In `~/.config/helix/languages.toml`:

```toml
[language-server.lumiose]
command = "npx"
args = ["--no-install", "lumiose-language-server", "--stdio"]

# .stsx files: TSX plus <style> blocks, colored with the TSX grammar.
[[language]]
name = "stsx"
scope = "source.stsx"
file-types = ["stsx"]
roots = ["vite.config.ts", "package.json"]
grammar = "tsx"
comment-tokens = "//"
block-comment-tokens = { start = "/*", end = "*/" }
indent = { tab-width = 2, unit = "  " }
language-servers = ["lumiose"]

# Takeover: one TypeScript server, through Lumiose, for .ts and .tsx files too.
[[language]]
name = "typescript"
roots = ["vite.config.ts", "package.json"]
language-servers = ["lumiose"]

[[language]]
name = "tsx"
roots = ["vite.config.ts", "package.json"]
language-servers = ["lumiose"]
```

> **Queries:** the `stsx` language reuses the TSX grammar, and its queries come from TSX: create
> `~/.config/helix/runtime/queries/stsx/highlights.scm` with the single line `; inherits: tsx`,
> and the same for `indents.scm`, `injections.scm`, `locals.scm` and `textobjects.scm`.

> **Check:** `hx --health stsx` checks the setup. To keep the TypeScript override to Lumiose
> projects, put the `language-server` and `typescript`/`tsx` entries in the project's
> `.helix/languages.toml` instead.

## GitHub

```
*.stsx linguist-language=TSX
```

This line in `.gitattributes` makes GitHub highlight `.stsx` files as TSX. `create-lumiose` writes
the file, and `lumiose agents init` adds the line to an existing project.

## Zed and other editors

- **Zed** runs language servers only through its extensions, and this version of Lumiose has no
  Zed extension, so the server's features are not available in Zed. Mapping `.stsx` to Zed's TSX
  language (`"file_types": { "TSX": ["stsx"] }`) colors the files, but Zed's TypeScript server then
  reports the CSS of every `<style>` block as TSX syntax errors. Use VS Code, Neovim or Helix for
  `.stsx` files, and run `lumiose check` for the diagnostics.
- **Any editor with an LSP client** works with the settings in
  [Set up the server](#set-up-the-server).
- **JetBrains IDEs** have no Lumiose plugin.

## What the server adds

Every editor runs the same Lumiose language server. It proxies TypeScript for `.ts`, `.tsx` and
`.stsx` files and adds:

- CSS features inside `<style>` blocks;
- class completion, definitions and rename that follow placement: the blocks enclosing the
  cursor (never a sibling subtree's), the file's, and the project's global classes (`<style global>`
  blocks and imported global `.css` files);
- `var(--…)` completion of every custom property declared in the project, with its value;
- descriptions of `<style global>` and of Lumiose attributes (`client:*`, `bind:*`, `on:*`, `attach`,
  `ref`, `key`), and the snippets `comp`, `acomp`, `route` and `island`;
- the compiler's `LUMxxxx` diagnostics, with the project-wide ones (`LUM4003` server-only imports
  in the client graph, `LUM3012` unread custom properties) that follow the other files' edits;
- hovers on JSX expressions with their execution contract: tracked (re-runs when the signals it
  reads change, which it lists), once, untracked or deferred, and the runtime helper that runs it.

See [Compiler and diagnostics](../concepts/compiler.md).
