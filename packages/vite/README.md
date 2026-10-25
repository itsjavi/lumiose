# @lumiose/vite

The [Lumiose](https://lumiose.dev/) Vite 8 plugin: compiles `.stsx` and `.tsx` with the
Lumiose compiler, runs the dev server with diagnostics in the overlay, and builds every rendering
mode (static, server, islands and SPA).

```sh
pnpm add lumiose
pnpm add -D @lumiose/vite vite
```

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
});
```

Options (`mode`, `i18n`, `adapter`, `svg`, `md`, `html`, …) are listed in the
[`@lumiose/vite` reference](https://lumiose.dev/docs/reference/vite/). New projects get this
setup from `npm create lumiose@latest`.

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
