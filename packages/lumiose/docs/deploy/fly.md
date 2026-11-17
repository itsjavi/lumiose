# Fly.io

> Run a Lumiose app on Fly.io from the Docker guide's image, behind Fly's proxy.

> **Status:** Not tested on Fly.io yet: the image is
> ([verification table](README.md#verification)).

## 1. Configure

```sh
fly launch
```

```toml
# fly.toml
app = "my-app"
primary_region = "ams"

[env]
NODE_ENV = "production"
PORT = "3000"

[http_service]
internal_port = 3000
force_https = true
auto_stop_machines = "stop"
auto_start_machines = true
min_machines_running = 0

[[http_service.checks]]
grace_period = "10s"
interval = "30s"
method = "GET"
timeout = "5s"
path = "/"
```

Add the Dockerfile and `.dockerignore` from [Docker](docker.md), then create the app with
`fly launch`: it finds the Dockerfile (decline the database offers you do not need). Adjust the
generated `fly.toml` to this one.

## 2. Deploy

```sh
fly secrets set LUMIOSE_SECRET="$(openssl rand -base64 32)"
fly deploy
```

Secrets go in with `fly secrets set`. Fly builds the image and starts it behind its proxy.

## 3. Verify

Open the URL the platform gives the app: the home page loads. From a terminal, `curl -sI` with
that URL shows the status line, which should say `200`.

## Notes

- Fly's proxy terminates TLS and forwards the `Host` header, so request URLs are right without
  `ORIGIN`.
- `ctx.platform.clientAddress` is the proxy's address, and the client's is in the
  `Fly-Client-IP` header.
- The adapter compresses responses itself; Fly's proxy passes them through.
