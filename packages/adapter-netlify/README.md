# @lumiose/adapter-netlify

Deploys a [Lumiose](https://itsjavi.com/lumiose/) build to Netlify: `dist/client` as the site, and
the build's fetch handler as a Netlify Function.

```sh
pnpm add -D @lumiose/adapter-netlify
```

```ts
// vite.config.ts
import { netlify } from "@lumiose/adapter-netlify";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ adapter: netlify() })],
});
```

The `netlify.toml` and the rest: [Deploy to Netlify](https://itsjavi.com/lumiose/docs/deploy/netlify/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
