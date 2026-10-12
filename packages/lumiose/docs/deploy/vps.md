# VPS

> Run a Lumiose app on your own server: `@lumiose/adapter-node` under systemd or pm2, with Caddy or nginx in front for TLS. The adapter already compresses responses and caches hashed assets, so the proxy needs no rules for either.

This page covers an app with server routes and the `server.ts` that `create-lumiose --template ssr`
writes. The examples call the app `my-app`, serve it as `example.com`, and keep it in
`/srv/my-app`. To run it in Docker on the server instead, see [Docker](docker.md).

## Build and install

The server needs Node 24 or later. Build on the server, or in CI and copy the output. The build
loads the compiler's native binary, published for Linux x64 and arm64 on glibc and for x64 on
musl (Alpine; arm64 too from the release after 0.2.0); on another platform, build in CI.

```sh
pnpm install --frozen-lockfile
pnpm build
```

To ship production dependencies only, build in CI (or with the [Docker](docker.md) image's
`build` stage), copy `dist/`, `server.ts`, `package.json`, `pnpm-lock.yaml` and
`pnpm-workspace.yaml` (if any) to `/srv/my-app`, and run
`pnpm install --frozen-lockfile --prod` there. Then start it with `node server.ts`, which serves
`dist/` on `PORT` (3000).

## What the adapter already does

`createServer()` serves `dist/client` first, then the app ([`@lumiose/adapter-node`](../reference/adapter-node.md)):

- **Compression.** Static files are sent from the `.br` and `.gz` copies that `lumiose build`
  writes next to every text file of 1 kB or more (brotli 11, gzip 9), at no CPU cost per request.
  Pages and endpoints with a text content type are compressed as they stream: brotli quality 4,
  else gzip 6. Every compressible response gets `Vary: Accept-Encoding`.
- **Caching.** Content-hashed files under `assets/` (`loader-BzIcWyn5.js`) get
  `Cache-Control: public, max-age=31536000, immutable`; a new build changes their names. Every
  other file, prerendered pages included, gets `public, max-age=0, must-revalidate` with an `ETag`
  and `Last-Modified`, answered with `304` when unchanged. Pages rendered per request send what
  the app sets (`response().setHeader("cache-control", …)`).
- **Headers.** `lumiose({ headers })` and the default `X-Content-Type-Options` and
  `Referrer-Policy` go on static files and pages alike.

So the proxy only adds TLS, HTTP/2 and connection limits. Proxy every request to Node: a proxy
that serves `dist/client` itself would have to repeat the caching rules and the headers above.
With compression on in both, the proxy leaves the already encoded responses alone; or pass
`compress: false` to `createServer()` and let the proxy compress.

## The process

### systemd

Create a system user that owns nothing it runs:

```sh
sudo useradd --system --home-dir /srv/my-app --shell /usr/sbin/nologin my-app
```

Put the secrets in `/etc/my-app.env`, one `KEY=value` per line, readable by root only
(`sudo chmod 600 /etc/my-app.env`):

```sh
LUMIOSE_SECRET=paste-the-output-of-openssl-rand-base64-32
```

`/etc/systemd/system/my-app.service`:

```ini
[Unit]
Description=my-app (Lumiose)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=my-app
Group=my-app
WorkingDirectory=/srv/my-app
ExecStart=/usr/bin/node server.ts
Environment=NODE_ENV=production HOST=127.0.0.1 PORT=3000 ORIGIN=https://example.com
# Secrets as KEY=value lines (LUMIOSE_SECRET=…), readable by root only.
EnvironmentFile=/etc/my-app.env
Restart=on-failure
RestartSec=2
# The app can read /srv/my-app and write only its state directory, /var/lib/my-app.
StateDirectory=my-app
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now my-app
journalctl -u my-app -f                # logs
sudo systemctl restart my-app          # after deploying a new build
```

Set `ExecStart` to the path `command -v node` prints. `HOST=127.0.0.1` keeps the app off the
public network: only the proxy reaches it. Point file databases and uploads at `/var/lib/my-app`
(the `StateDirectory`): with `ProtectSystem=strict`, it and a private `/tmp` are the only places
the app can write.

### pm2

`ecosystem.config.cjs`, next to `server.ts`:

```js
module.exports = {
  apps: [
    {
      name: "my-app",
      cwd: "/srv/my-app",
      script: "server.ts",
      // Node runs server.ts itself; pm2 6 would start .ts files with Bun.
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
        ORIGIN: "https://example.com",
      },
    },
  ],
};
```

```sh
LUMIOSE_SECRET=… pm2 start ecosystem.config.cjs   # the app inherits this shell's variables
pm2 save && pm2 startup                           # restart it on boot
pm2 logs my-app
```

`pm2 save` writes the process list with its environment, the secret included, to
`~/.pm2/dump.pm2`, which `pm2 resurrect` (run at boot by the script `pm2 startup` installs)
restores. This runs one process (pm2's fork mode); pm2's cluster mode has not been tested with
Lumiose.

## The proxy

Set `ORIGIN` to the public origin (`https://example.com`), as in the configs above. The app
then builds request URLs (`url()`, `ctx.url`) with `https:` and your host, not the `http:` it
receives from the proxy. Without `ORIGIN`, the URL comes from the `Host` header, which the proxy
must pass through. The cross-site check of form posts compares the browser's `Origin` host with
that URL's host. Behind a proxy, the app's `clientAddress` is the proxy's: read
`X-Forwarded-For`, which both configs set, in middleware.

### Caddy

`/etc/caddy/Caddyfile`:

```caddy
example.com {
	reverse_proxy 127.0.0.1:3000
}
```

Caddy gets and renews the certificate, redirects HTTP to HTTPS, passes `Host` and sets
`X-Forwarded-For`/`X-Forwarded-Proto`. It flushes streamed responses as they arrive, so
`<Suspense>` chunks are not held back. It needs no `encode` directive: responses arrive
compressed.

### nginx

`/etc/nginx/sites-available/my-app` (linked into `sites-enabled`), with a certificate from
certbot:

```nginx
upstream my_app {
    server 127.0.0.1:3000;
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # The app accepts uploads up to 10 MB (lumiose({ limits })); nginx's default is 1 MB.
    client_max_body_size 10m;

    location / {
        proxy_pass http://my_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Send each streamed chunk (a <Suspense> boundary) to the browser as it arrives.
        proxy_buffering off;
    }
}
```

`proxy_set_header Host $host` matters: nginx sends the upstream's name (`my_app`) as `Host`
otherwise. `http2 on` needs nginx 1.25.1 or later; on older versions, write `listen 443 ssl http2`.
`proxy_http_version 1.1` with an empty `Connection` header reuses connections to Node
(`keepalive`). For WebSockets, add the `/ws` location from the [realtime guide](../guides/realtime.md#behind-a-proxy).
`client_max_body_size` should match the largest body the app accepts
([Security](../concepts/security.md)), or nginx answers `413` first.
