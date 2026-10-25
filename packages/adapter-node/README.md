# @lumiose/adapter-node

Serves a [Lumiose](https://lumiose.dev/) build with Node: the static files of `dist/client`
(with their compressed copies and caching headers), then the app's request handler, with streamed
responses. `lumiose preview` uses it too.

```sh
pnpm add @lumiose/adapter-node
```

```ts
// server.ts
import { createServer } from "@lumiose/adapter-node";

const { url } = await createServer({ dir: new URL("dist", import.meta.url) });
console.log(`Listening on ${url}`);
```

Run `lumiose build`, then `node server.ts`. It reads `PORT`, `HOST` and `ORIGIN`.
API: [`@lumiose/adapter-node` reference](https://lumiose.dev/docs/reference/adapter-node/).
Deploying: [VPS](https://lumiose.dev/docs/deploy/vps/),
[Docker](https://lumiose.dev/docs/deploy/docker/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
