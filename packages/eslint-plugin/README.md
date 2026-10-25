# @lumiose/eslint-plugin

The [Lumiose](https://lumiose.dev/) compiler's `LUMxxxx` diagnostics as lint rules for oxlint
(JS plugins) and ESLint, with their help text and fixes, so every tool agrees with `lumiose check`.

```sh
pnpm add -D @lumiose/eslint-plugin
```

**oxlint** lints `.tsx` files (it cannot parse `.stsx` yet; `lumiose lint` covers those):

```json
// .oxlintrc.json
{
  "jsPlugins": ["@lumiose/eslint-plugin"],
  "rules": { "lumiose/compiler": "error", "lumiose/compiler-warnings": "warn" }
}
```

**ESLint 9** lints `.stsx` files too, through the recommended config's processor:

```js
// eslint.config.js
import lumiose from "@lumiose/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
  ...lumiose.configs.recommended,
  { files: ["**/*.tsx", "**/*.stsx/*.tsx"], languageOptions: { parser: tseslint.parser } },
];
```

Project-wide checks need the whole project: run `lumiose check` for those. More:
[oxlint, ESLint and Prettier](https://lumiose.dev/docs/reference/cli/#oxlint-eslint-and-prettier).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
