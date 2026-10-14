# @lumiose/adapter-vercel

Deploys a [Lumiose](https://itsjavi.com/lumiose/) build to Vercel through the Build Output API:
static files, and the build's fetch handler as a Node.js or Edge function.

```sh
pnpm add -D @lumiose/adapter-vercel
```

```ts
// vite.config.ts
import { vercel } from "@lumiose/adapter-vercel";
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ adapter: vercel() })], // or vercel({ runtime: "edge" })
});
```

Project settings and deploying from the command line: [Deploy to Vercel](https://itsjavi.com/lumiose/docs/deploy/vercel/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
