# @lumiose/adapter-cloudflare

Deploys a [Lumiose](https://itsjavi.com/lumiose/) build to Cloudflare Workers: the build's fetch
handler as the Worker, `dist/client` as static assets, bindings as `ctx.platform.env`.

```sh
pnpm add -D @lumiose/adapter-cloudflare wrangler
```

```ts
// vite.config.ts
import { cloudflare } from "@lumiose/adapter-cloudflare";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ adapter: cloudflare() })],
});
```

The `wrangler.jsonc` and the rest: [Deploy to Cloudflare Workers](https://itsjavi.com/lumiose/docs/deploy/cloudflare/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
