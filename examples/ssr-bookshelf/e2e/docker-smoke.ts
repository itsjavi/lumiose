// Local smoke test of ../Dockerfile (TASK-249): builds the image from the repository root, runs
// it, and checks the container: a server-rendered page, a prerendered page, a hashed asset's
// caching and compression, the health check, the unprivileged user, that no build tool shipped,
// and a quick stop. Needs Docker. CI never runs it (a cold build compiles the Rust compiler), and
// it skips itself when Docker is missing or `CI` is set.
//
//   node examples/ssr-bookshelf/e2e/docker-smoke.ts             # build, then check
//   node examples/ssr-bookshelf/e2e/docker-smoke.ts --no-build  # check the last build

import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const IMAGE = "lumiose-bookshelf:smoke";
const IMMUTABLE = "public, max-age=31536000, immutable";

function docker(...args: string[]): string {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function dockerAvailable(): boolean {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === "" ? "" : `: ${detail}`}`);
}

async function waitForHealth(container: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = docker("inspect", "-f", "{{.State.Status}} {{.State.Health.Status}}", container);
    const [status, health] = state.split(" ");
    if (health === "healthy" || health === "unhealthy" || status !== "running") return state;
    if (Date.now() > deadline) return state;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function get(url: string): Promise<{ response: Response; body: string }> {
  // Ask for brotli explicitly; fetch decodes the body and keeps the Content-Encoding header.
  const response = await fetch(url, { headers: { "accept-encoding": "br" } });
  return { response, body: await response.text() };
}

async function main(): Promise<void> {
  if (process.env.CI) {
    console.log("docker-smoke: skipped in CI.");
    return;
  }
  if (!dockerAvailable()) {
    console.log("docker-smoke: skipped, Docker is not available.");
    return;
  }
  if (!process.argv.includes("--no-build")) {
    const started = Date.now();
    const build = spawnSync(
      "docker",
      ["build", "-f", "examples/ssr-bookshelf/Dockerfile", "-t", IMAGE, "."],
      { cwd: REPO, stdio: "inherit" },
    );
    if (build.status !== 0) throw new Error("docker build failed.");
    console.log(`Built ${IMAGE} in ${Math.round((Date.now() - started) / 1000)} s.`);
  }

  const container = docker(
    "run",
    "--detach",
    "--rm",
    "--publish",
    "127.0.0.1::3000",
    "--env",
    `LUMIOSE_SECRET=${randomBytes(32).toString("hex")}`,
    IMAGE,
  );
  let running = true;
  try {
    const health = await waitForHealth(container, 60_000);
    check("container becomes healthy", health === "running healthy", health);
    if (health !== "running healthy") {
      console.log(docker("logs", container));
      return;
    }
    const base = `http://${docker("port", container, "3000/tcp").split("\n")[0]}`;
    const logs = docker("logs", container);
    check("seeds the empty database on first start", logs.includes("Seeded /data/bookshelf.db"));

    const home = await get(`${base}/`);
    check("GET / renders on the server", home.response.status === 200, `${home.response.status}`);
    check(
      "GET / streams the recommendations",
      home.body.includes("Bookshelf") && home.body.includes("/books/97"),
    );
    check(
      "GET / is compressed on the fly",
      home.response.headers.get("content-encoding") === "br",
      `${home.response.headers.get("content-encoding")}`,
    );

    const books = await get(`${base}/books?q=bakery`);
    check("GET /books?q= queries the database", books.body.includes("A Bakery to Remember"));

    const about = await get(`${base}/about`);
    check("GET /about serves the prerendered page", about.response.status === 200);
    check(
      "GET /about revalidates",
      about.response.headers.get("cache-control") === "public, max-age=0, must-revalidate" &&
        about.response.headers.has("etag"),
      `${about.response.headers.get("cache-control")}`,
    );

    // Prerendered from the database the build seeded.
    const genres = await get(`${base}/genres`);
    const genre = /href="(\/genres\/[\w-]+)"/.exec(genres.body)?.[1];
    const genrePage = genre === undefined ? undefined : await get(`${base}${genre}`);
    check(
      "GET /genres/<slug> serves a prerendered genre page",
      genrePage?.response.status === 200 && genrePage.response.headers.has("last-modified"),
      `${genre}`,
    );

    const assets = [...about.body.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
      (match) => match[1]!,
    );
    check("the prerendered page links hashed assets", assets.length > 0, assets.join(", "));
    let precompressed = 0;
    for (const asset of assets) {
      const { response } = await get(`${base}${asset}`);
      check(
        `GET ${asset} is immutable`,
        response.headers.get("cache-control") === IMMUTABLE,
        `${response.headers.get("cache-control")}`,
      );
      if (response.headers.get("content-encoding") === "br") precompressed++;
    }
    check(
      "assets of 1 kB or more come from their .br copies",
      precompressed > 0,
      `${precompressed}`,
    );

    const me = await fetch(`${base}/api/me`);
    check("GET /api/me (the health check URL)", me.status === 200);

    // A form action with a signed session cookie (LUMIOSE_SECRET), same-origin.
    const login = await fetch(`${base}/login`, {
      method: "POST",
      redirect: "manual",
      headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "reader@example.com", password: "bookshelf" }),
    });
    check(
      "POST /login signs in",
      login.status === 303 &&
        login.headers.getSetCookie().some((c) => c.startsWith("bookshelf_session=")),
      `${login.status}`,
    );

    const uid = docker("exec", container, "id", "-u");
    check("runs as an unprivileged user", uid !== "0", `uid ${uid}`);
    // The sample's links (`lumiose`, `@lumiose/adapter-node`) and the virtual store's packages.
    const installed = docker(
      "exec",
      container,
      "sh",
      "-c",
      "ls -A node_modules node_modules/@lumiose /app/node_modules/.pnpm 2>/dev/null || true",
    ).split(/\s+/);
    const devOnly = installed.filter((entry) =>
      /^(?:vite|cli|compiler|typescript|@playwright|@lumiose\+(?:vite|cli|compiler))(?:@|$)/.test(
        entry,
      ),
    );
    check("ships production dependencies only", devOnly.length === 0, installed.join(" "));

    const stopping = Date.now();
    docker("stop", container);
    running = false;
    const stopMs = Date.now() - stopping;
    check("stops promptly on SIGTERM", stopMs < 5000, `${stopMs} ms`);
  } finally {
    if (running) spawnSync("docker", ["rm", "--force", container], { stdio: "ignore" });
  }
}

await main();
if (failures > 0) {
  console.log(`docker-smoke: ${failures} check(s) failed.`);
  process.exitCode = 1;
}
