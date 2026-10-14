# @lumiose/prettier-plugin

Prettier support for [Lumiose](https://itsjavi.com/lumiose/) `.stsx` files: the TSX with Prettier's
TypeScript printer and each `<style>` block with its CSS printer, re-indented at its placement, like
`lumiose fmt`. A file with scanner or syntax errors is reported, not changed.

```sh
pnpm add -D @lumiose/prettier-plugin
```

```json
// .prettierrc.json
{ "plugins": ["@lumiose/prettier-plugin"] }
```

With oxfmt, which has no plugin API, format `.stsx` with `lumiose fmt`. More:
[oxlint, ESLint and Prettier](https://itsjavi.com/lumiose/docs/reference/cli/#oxlint-eslint-and-prettier).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
