# Coolify

> Deploy to Coolify with its Dockerfile build pack: the port, a domain, secrets, the health check and a volume for data.

[Coolify](https://coolify.io) builds the app's Dockerfile on your server and runs the image behind
its proxy, which terminates TLS for the domain. Lumiose needs nothing Coolify-specific: the image
is the one from [Docker](docker.md). The field names below follow Coolify v4's documentation; this
guide has not been run on a Coolify instance yet (see the [verification table](README.md#verification)).

## 1. Add the Dockerfile

Commit the [Dockerfile and `.dockerignore`](docker.md#the-dockerfile) at the root of the
repository. Check that it builds locally (`docker build -t my-app .`): Coolify runs the same build.

## 2. Create the application

In Coolify, **+ New**, pick the project and environment, connect the repository (a public URL, a
Git App or a deploy key) and choose the **Dockerfile** build pack. Then, under **General**:

| Field                   | Value                                                           |
| ----------------------- | --------------------------------------------------------------- |
| **Base Directory**      | `/`, the build context (the directory with `package.json`)      |
| **Dockerfile Location** | `/Dockerfile`, relative to the base directory                   |
| **Ports Exposes**       | `3000`, the image's `PORT`                                      |
| **Domains**             | `https://example.com`; Coolify's proxy gets the TLS certificate |

Coolify sets `PORT` to the first exposed port and `HOST` to `0.0.0.0` when they are not set,
which is what `createServer()` reads.

## 3. Environment variables

Under **Environment Variables**:

| Variable         | Value                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`         | The domain, `https://example.com`. The proxy speaks plain HTTP to the container, so request URLs (`url()`) need it. |
| `LUMIOSE_SECRET` | When the app signs cookies: `openssl rand -base64 32`. Set **Build time** to **Not available during build**.        |
| Your own secrets | Database URLs, API keys: also **Not available during build**, since only the running server reads them.             |

New variables are available during the build by default; a secret that reaches the build can end
up in the image's layers. Restart or redeploy after changing them.

## 4. Health check

The image's `HEALTHCHECK` fetches `HEALTHCHECK_PATH` (`/` by default) inside the container. For a
Dockerfile application, Coolify uses an image's `HEALTHCHECK` instead of the one in its
**Healthcheck** settings, waits for the new container to be healthy before it replaces the old
one, and its default proxy (Traefik) stops routing to a container that turns unhealthy. To check a cheaper URL than the home
page, add a `GET` endpoint such as `/healthz` and set `HEALTHCHECK_PATH=/healthz` as a variable.
A health check configured in Coolify's dashboard instead runs `curl` or `wget` in the container;
Alpine has `wget`.

## 5. Persistent storage

Files the app writes at run time (a SQLite database, uploads) are lost when Coolify replaces the
container, unless they live on a volume. Create the directory for the `node` user in the
Dockerfile, before `USER node`:

```dockerfile
RUN mkdir /data && chown node:node /data
```

Then **Configuration**, **Persistent Storage**, **Add**, **Volume Mount**, with `/data` as the
**Destination Path**, and point the app at it (`DATABASE_PATH=/data/app.db`, or whatever your app
reads). Redeploy, and back the volume up outside the server.

## 6. Deploy

**Deploy**, then read the build log (the three Dockerfile stages) and the runtime logs (the
`Listening on …` line of `server.ts`). Pushes to the branch redeploy when automatic deployments
are on.

## A monorepo

Set **Base Directory** to the directory the Dockerfile's `COPY` lines are relative to, and
**Dockerfile Location** to the Dockerfile's path from there. The bookshelf sample, for example,
builds from the repository root with `/examples/ssr-bookshelf/Dockerfile`
([its notes](docker.md#the-bookshelf-sample)).
