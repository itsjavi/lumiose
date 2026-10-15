# Editors: Neovim, Helix and Zed

> Run the Lumiose language server in Neovim and Helix (file type, root markers, the server command), what works in Zed today, and how GitHub highlights `.stsx` files.

VS Code has the Lumiose extension, which bundles the language server
([Getting started](../getting-started.md#editor)). Other editors start the same server over the
Language Server Protocol. It gives them everything the extension shows: TypeScript for `.ts`,
`.tsx` and `.stsx` files, CSS features in `<style>` blocks, class and custom property completion,
the compiler's `LUMxxxx` diagnostics and hovers that explain how each JSX expression runs.

## Set up the server

Install it in the project, so it matches your `lumiose` version:

```sh
pnpm add -D @lumiose/language-server
```

Every editor needs the same four things:

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

Do not enable `ts_ls` or `vtsls` for the same projects (with nvim-lspconfig, leave them out of
`vim.lsp.enable`). `:checkhealth vim.lsp` shows the attached client.

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

The `stsx` language reuses the TSX grammar, and its queries come from TSX: create
`~/.config/helix/runtime/queries/stsx/highlights.scm` with the single line `; inherits: tsx`, and
the same for `indents.scm`, `injections.scm`, `locals.scm` and `textobjects.scm`. To keep the
TypeScript override to Lumiose projects, put the `language-server` and `typescript`/`tsx` entries
in the project's `.helix/languages.toml` instead. `hx --health stsx` checks the setup.

## Zed

Zed runs language servers only through its extensions, and this version of Lumiose has no Zed
extension, so the server's features are not available in Zed. Mapping `.stsx` to Zed's TSX
language (`"file_types": { "TSX": ["stsx"] }`) colors the files, but Zed's TypeScript server then
reports the CSS of every `<style>` block as TSX syntax errors. Use VS Code, Neovim or Helix for
`.stsx` files, and run `lumiose check` for the diagnostics.

## Other editors

Any editor with an LSP client works with the settings in [Set up the server](#set-up-the-server).
JetBrains IDEs have no Lumiose plugin.

## GitHub

GitHub highlights `.stsx` files as TSX through `.gitattributes`:

```
*.stsx linguist-language=TSX
```

`create-lumiose` writes this file, and `lumiose agents init` adds the line to an existing project.
