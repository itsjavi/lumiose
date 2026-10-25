# @lumiose/language-server

The [Lumiose](https://lumiose.dev/) language server: a TypeScript 7 proxy for `.ts`, `.tsx` and
`.stsx` files, with CSS features inside `<style>` blocks, class completion that follows scoping,
custom property completion, the compiler's diagnostics and hovers that explain how each JSX
expression runs.

The Lumiose VS Code extension bundles it. Install it as a dev dependency only to pin the server to
your `lumiose` version:

```sh
pnpm add -D @lumiose/language-server
```

Other editors start it over the Language Server Protocol:

```sh
lumiose-language-server --stdio   # also --node-ipc, --socket=<port>, --pipe=<name>
```

What it adds in the editor: [Getting started](https://lumiose.dev/docs/getting-started/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
