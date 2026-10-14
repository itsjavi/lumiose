# @lumiose/adapter-node

Serves a [Lumiose](https://itsjavi.com/lumiose/) build with Node: the static files of `dist/client`
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
API: [`@lumiose/adapter-node` reference](https://itsjavi.com/lumiose/docs/reference/adapter-node/).
Deploying: [VPS](https://itsjavi.com/lumiose/docs/deploy/vps/),
[Docker](https://itsjavi.com/lumiose/docs/deploy/docker/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
