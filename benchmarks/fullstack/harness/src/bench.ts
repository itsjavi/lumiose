// The fullstack comparison benchmark runner (doc-4 §4, §6, §7). Runs every metric group across the
// selected apps, one group at a time and the apps one after the other inside it (server rounds are
// interleaved across apps instead, with a cool-down and an idle check before each), then writes
// results/<date>-<host>.json and results/index.json.
//
//   pnpm --filter @bench/harness bench [--quick] [--only lumiose,next] [--metrics dev,build,load,server,other]
//        [--network slow4g] [--comments-delay 0] [--skip-conformance] [--iterations dev=5,build=3,load=5,server=3]
//
// Apps that fail the conformance suite are not benchmarked. Full runs belong on a quiet machine.
import { chromium, type Browser } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  type App,
  type Server,
  REPO,
  baseUrl,
  listenerEnv,
  resolvedVersion,
  runScript,
  sampleRoutes,
  scriptOf,
  startServer,
} from "./apps.ts";
import { args, selectApps } from "./cli.ts";
import { checkApp } from "./conformance.ts";
import {
  NETWORK_PROFILES,
  dependencyCount,
  devPageLoad,
  dirSize,
  hmr,
  loadTest,
  pageLoad,
  payload,
  sourceSize,
  waitForIdle,
} from "./measure.ts";
import {
  GROUPS,
  type Group,
  type MetricDef,
  Recorder,
  type RunFile,
  machine,
  shortHost,
  writeRun,
} from "./results.ts";

const values = args({
  quick: { type: "boolean", default: false },
  only: { type: "string" },
  metrics: { type: "string" },
  network: { type: "string" },
  "comments-delay": { type: "string", default: "0" },
  "skip-conformance": { type: "boolean", default: false },
  iterations: { type: "string" },
});

const startedAt = new Date().toISOString();
const quick = values.quick;
const groups = (values.metrics?.split(",") ?? GROUPS).map((g) => g.trim()) as Group[];
for (const group of groups)
  if (!GROUPS.includes(group)) throw new Error(`unknown metric group ${group}`);
const iterations = quick
  ? { dev: 1, build: 1, load: 1, server: 1 }
  : { dev: 5, build: 3, load: 5, server: 3 };
for (const pair of values.iterations?.split(",") ?? []) {
  const [key, n] = pair.split("=") as [keyof typeof iterations, string];
  if (!(key in iterations)) throw new Error(`unknown iterations key ${key}`);
  iterations[key] = Number(n);
}
const network = values.network === undefined ? undefined : NETWORK_PROFILES[values.network];
if (values.network !== undefined && network === undefined) {
  throw new Error(
    `unknown network profile ${values.network} (known: ${Object.keys(NETWORK_PROFILES).join(", ")})`,
  );
}
const serverRuns = quick
  ? { warmup: 1, runs: 1, duration: 3 }
  : { warmup: 3, runs: 3, duration: 10 };
/** Cool-down and idle check before every server round (load average per core). */
const idle = quick
  ? { coolDownMs: 500, maxLoadPerCore: 0.5, timeoutMs: 5_000 }
  : { coolDownMs: 3_000, maxLoadPerCore: 0.5, timeoutMs: 60_000 };
const busyRounds: string[] = [];
/** `items` rotated left by `n`: round i starts with a different app. */
const rotate = <T>(items: T[], n: number): T[] =>
  items.map((_, k) => items[(k + n) % items.length]!);
const CPU_THROTTLING = 4;
const env = { COMMENTS_DELAY_MS: values["comments-delay"] };

const ROUTES = { home: "/", project: "/projects/:slug", issue: "/issues/:id" } as const;
type Route = keyof typeof ROUTES;

const recorder = new Recorder();
const notes: string[] = [];
const firstLine = (error: unknown) => (error as Error).message.split("\n")[0];
const log = (message: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

function def(
  group: Group,
  label: string,
  unit: MetricDef["unit"],
  section?: string,
  better: MetricDef["better"] = "lower",
): Omit<MetricDef, "env"> {
  return section === undefined
    ? { label, group, unit, better }
    : { label, group, unit, better, section };
}

let apps = selectApps(values.only);
if (apps.length === 0) throw new Error("no app to benchmark (none of the selected apps exist yet)");

const conformance: RunFile["meta"]["conformance"] = {};
for (const app of apps) {
  if (values["skip-conformance"]) {
    conformance[app.id] = "skipped";
    continue;
  }
  log(`${app.name}: conformance suite`);
  conformance[app.id] = (await checkApp(app, { build: true, quiet: true })) ? "pass" : "fail";
  if (conformance[app.id] === "fail") {
    log(
      `${app.name}: FAILS the conformance suite, not benchmarked (run \`conformance --only ${app.id}\` for details)`,
    );
  }
}
apps = apps.filter((app) => conformance[app.id] !== "fail");

const browser: Browser = await chromium.launch();
const routesOf = new Map<App, Record<Route, string>>();

/** NODE_ENV and compression of each app's production server, checked on its first start. */
const production = new Map<App, { nodeEnv: string | null; compression: boolean }>();

async function checkProduction(app: App): Promise<void> {
  if (production.has(app)) return;
  const nodeEnv = listenerEnv(app.port, "NODE_ENV");
  const response = await fetch(`${baseUrl(app)}/`, { headers: { "accept-encoding": "br, gzip" } });
  await response.arrayBuffer();
  const compression = response.headers.get("content-encoding") !== null;
  production.set(app, { nodeEnv, compression });
  if (nodeEnv !== "production") {
    throw new Error(`${app.id}: the production server runs with NODE_ENV=${nodeEnv ?? "(unset)"}`);
  }
  if (compression)
    notes.push(`${app.id}: the production server compresses responses (doc-4 wants it off).`);
}

async function withServer<T>(
  app: App,
  script: "dev" | "start",
  fn: (startMs: number) => Promise<T>,
): Promise<T> {
  const server = await startServer(app, script, env);
  try {
    if (script === "start") await checkProduction(app);
    return await fn(server.startMs);
  } finally {
    await server.stop();
  }
}

async function routes(app: App): Promise<Record<Route, string>> {
  let found = routesOf.get(app);
  if (found === undefined) {
    found = await sampleRoutes(app);
    routesOf.set(app, found);
  }
  return found;
}

try {
  for (const app of apps) await runScript(app, "seed");

  if (groups.includes("other")) {
    for (const app of apps) {
      log(`${app.name}: source size, dependencies, type check`);
      // React apps reuse @bench/react-ui; the Lumiose app writes its own markup: totals count both.
      const size = sourceSize(app);
      const loc = (key: string, label: string, value: number, unit: "lines" | "count") =>
        recorder.add(app.id, key, def("other", label, unit, "Source size"), value);
      loc(
        "other.loc",
        "Source lines (non-blank), app + shared UI",
        size.app.lines + size.shared.lines,
        "lines",
      );
      loc("other.loc-app", "… in the app", size.app.lines, "lines");
      loc("other.loc-shared", "… in shared UI packages", size.shared.lines, "lines");
      loc(
        "other.files",
        "Source files, app + shared UI",
        size.app.files + size.shared.files,
        "count",
      );
      loc("other.files-app", "… in the app", size.app.files, "count");
      loc("other.files-shared", "… in shared UI packages", size.shared.files, "count");
      recorder.add(
        app.id,
        "other.deps",
        def("other", "Production dependency packages", "count"),
        dependencyCount(app),
      );
      for (let i = 0; i < iterations.build; i++) {
        try {
          const ms = await runScript(app, "typecheck");
          recorder.add(app.id, "other.typecheck", def("other", "Type check", "ms"), ms);
        } catch (error) {
          // A type error is the app's problem, not a timing: record it and keep benchmarking.
          notes.push(`${app.id}: type check failed, not timed: ${firstLine(error)}`);
          break;
        }
      }
    }
  }

  if (groups.includes("dev")) {
    for (const app of apps) {
      for (let i = 0; i < iterations.dev; i++) {
        log(`${app.name}: dev cold start ${i + 1}/${iterations.dev}`);
        await runScript(app, "clean");
        await withServer(app, "dev", async (startMs) => {
          recorder.add(
            app.id,
            "dev.cold-start",
            def("dev", "Dev server cold start (spawn → first 200 on /)", "ms"),
            startMs,
          );
          const paths = await routes(app);
          for (const kind of ["first", "warm"] as const) {
            for (const route of Object.keys(ROUTES) as Route[]) {
              const { ttfb, load } = await devPageLoad(browser, baseUrl(app) + paths[route]);
              const section = `${kind === "first" ? "First" : "Warm"} load ${ROUTES[route]}`;
              recorder.add(
                app.id,
                `dev.${kind}.${route}.ttfb`,
                def("dev", "TTFB", "ms", section),
                ttfb,
              );
              recorder.add(
                app.id,
                `dev.${kind}.${route}.load`,
                def("dev", "load event", "ms", section),
                load,
              );
            }
          }
          try {
            recorder.add(
              app.id,
              "dev.hmr",
              def("dev", "HMR: shared component edit → DOM", "ms"),
              await hmr(browser, app),
            );
          } catch (error) {
            notes.push(`${app.id}: HMR not measured: ${firstLine(error)}`);
          }
        });
        log(`${app.name}: dev warm start ${i + 1}/${iterations.dev}`);
        await withServer(app, "dev", async (startMs) => {
          recorder.add(
            app.id,
            "dev.warm-start",
            def("dev", "Dev server warm start (caches kept)", "ms"),
            startMs,
          );
        });
      }
    }
  }

  const needsBuild = groups.includes("load") || groups.includes("server");
  if (groups.includes("build") || needsBuild) {
    for (const app of apps) {
      const timed = groups.includes("build") ? iterations.build : 1;
      for (let i = 0; i < timed; i++) {
        log(`${app.name}: production build ${i + 1}/${timed}`);
        await runScript(app, "clean");
        const ms = await runScript(app, "build");
        if (groups.includes("build"))
          recorder.add(
            app.id,
            "build.time",
            def("build", "Production build (cold, after clean)", "ms"),
            ms,
          );
      }
      if (!groups.includes("build")) continue;
      const size = (dirs: string[]) =>
        dirs.reduce((sum, dir) => sum + dirSize(join(app.dir, dir)), 0);
      recorder.add(
        app.id,
        "build.client-size",
        def("build", "Client output on disk", "bytes"),
        size(app.clientOutput),
      );
      recorder.add(
        app.id,
        "build.server-size",
        def("build", "Server output on disk", "bytes"),
        size(app.serverOutput),
      );
      await withServer(app, "start", async () => {
        const paths = await routes(app);
        for (const route of Object.keys(ROUTES) as Route[]) {
          log(`${app.name}: client payload ${ROUTES[route]}`);
          const p = await payload(browser, baseUrl(app) + paths[route]);
          const section = `Client payload ${ROUTES[route]}`;
          const add = (
            key: string,
            label: string,
            value: number,
            unit: MetricDef["unit"] = "bytes",
          ) =>
            recorder.add(
              app.id,
              `payload.${route}.${key}`,
              def("build", label, unit, section),
              value,
            );
          add("js-raw", "JS (raw)", p.jsRaw);
          add("js-gzip", "JS (gzip)", p.jsGzip);
          add("js-brotli", "JS (brotli)", p.jsBrotli);
          add("css-raw", "CSS (raw)", p.cssRaw);
          add("css-gzip", "CSS (gzip)", p.cssGzip);
          add("css-brotli", "CSS (brotli)", p.cssBrotli);
          add("html-raw", "HTML document (raw)", p.htmlRaw);
          add("html-gzip", "HTML document (gzip)", p.htmlGzip);
          add("requests", "Requests", p.requests, "count");
        }
      });
    }
  }

  if (groups.includes("load")) {
    for (const app of apps) {
      await withServer(app, "start", async () => {
        const paths = await routes(app);
        for (const route of Object.keys(ROUTES) as Route[]) {
          log(`${app.name}: page load ${ROUTES[route]} ×${iterations.load}`);
          const section = `${ROUTES[route]} (CPU ${CPU_THROTTLING}× slower${values.network ? `, ${values.network}` : ""})`;
          for (let i = 0; i < iterations.load; i++) {
            const t = await pageLoad(browser, baseUrl(app) + paths[route], {
              cpuThrottling: CPU_THROTTLING,
              network,
            });
            const add = (key: keyof typeof t, label: string) =>
              recorder.add(
                app.id,
                `load.${route}.${key}`,
                def("load", label, "ms", section),
                t[key],
              );
            add("ttfb", "TTFB");
            add("fcp", "First contentful paint");
            add("lcp", "Largest contentful paint");
            add("dcl", "DOMContentLoaded");
            add("load", "load event");
            add("tbt", "Total blocking time");
            add("ready", "Interactive (__benchReady)");
          }
        }
      });
    }
  }

  if (groups.includes("server")) {
    // Rounds are interleaved across apps (cold starts, then each route's load-test rounds) with a
    // cool-down and an idle check before each one, so a transient load spike on the machine
    // cannot land on a single framework's rounds.
    const idleCheck = async (what: string) => {
      const state = await waitForIdle(idle);
      if (!state.idle) {
        busyRounds.push(`${what} (load ${state.load.toFixed(1)})`);
        log(`  machine busy: 1-min load ${state.load.toFixed(1)}, running ${what} anyway`);
      }
    };
    for (let i = 0; i < iterations.server; i++) {
      for (const app of rotate(apps, i)) {
        await idleCheck(`${app.id} cold start ${i + 1}`);
        log(`${app.name}: server cold start ${i + 1}/${iterations.server}`);
        await withServer(app, "start", async (startMs) => {
          recorder.add(
            app.id,
            "server.cold-start",
            def("server", "Server cold start (spawn → first 200)", "ms"),
            startMs,
          );
        });
      }
    }
    // Every app's production server stays up (each on its own port) while the others are measured.
    const servers = new Map<App, Server>();
    try {
      for (const app of apps) {
        servers.set(app, await startServer(app, "start", env));
        await checkProduction(app);
      }
      const labels = {
        home: "/",
        project: "/projects/:slug?page=3",
        issue: "/issues/:id (streamed)",
        api: "/api/issues/:id",
      };
      const targets = new Map<App, Record<keyof typeof labels, string>>();
      for (const app of apps) {
        const paths = await routes(app);
        targets.set(app, {
          home: "/",
          project: `${paths.project}?page=3`,
          issue: paths.issue,
          api: `/api${paths.issue}`,
        });
      }
      for (const route of Object.keys(labels) as (keyof typeof labels)[]) {
        const section = `Throughput ${labels[route]}`;
        for (const app of apps) {
          log(`${app.name}: autocannon warm-up ${targets.get(app)![route]}`);
          await loadTest(baseUrl(app) + targets.get(app)![route], serverRuns.warmup);
        }
        for (let i = 0; i < serverRuns.runs; i++) {
          // Rotating the order (A B C, B C A, C A B) also spreads any position effect.
          for (const app of rotate(apps, i)) {
            const path = targets.get(app)![route];
            await idleCheck(`${app.id} ${labels[route]} round ${i + 1}`);
            log(`${app.name}: autocannon ${path} round ${i + 1}/${serverRuns.runs}`);
            const r = await loadTest(baseUrl(app) + path, serverRuns.duration);
            recorder.add(
              app.id,
              `server.${route}.rps`,
              def("server", "Requests/s", "req/s", section, "higher"),
              r.rps,
            );
            recorder.add(
              app.id,
              `server.${route}.p50`,
              def("server", "Latency p50", "ms", section),
              r.p50,
            );
            recorder.add(
              app.id,
              `server.${route}.p99`,
              def("server", "Latency p99", "ms", section),
              r.p99,
            );
            recorder.add(
              app.id,
              `server.${route}.errors`,
              def("server", "Errors and non-2xx", "count", section),
              r.errors,
            );
          }
        }
      }
      for (const [app, server] of servers) {
        recorder.add(
          app.id,
          "server.rss",
          def("server", "Server RSS after the load test", "MB"),
          server.rssMb(),
        );
      }
    } finally {
      for (const server of servers.values()) await server.stop();
    }
  }
} finally {
  await browser.close();
}

const anyApp = apps[0];
/** `pkg` as app `id` resolves it (`via` one of its dependencies), or as the first app does. */
const versionOf = (pkg: string, id: App["id"], via?: string) => {
  const app = apps.find((a) => a.id === id) ?? anyApp;
  return app === undefined ? null : resolvedVersion(app, pkg, via);
};
const servers: RunFile["meta"]["servers"] = {};
for (const app of apps) {
  const checked = production.get(app);
  const tool = resolvedVersion(app, app.devTool.pkg, app.devTool.via);
  servers[app.id] = {
    dev: {
      command: scriptOf(app, "dev"),
      tool:
        tool === null
          ? app.devTool.name
          : `${app.devTool.name} ${app.devTool.pkg === "next" ? `(next ${tool})` : tool}`,
      description: app.devServer,
    },
    build: { command: scriptOf(app, "build") },
    prod: {
      command: scriptOf(app, "start"),
      description: app.prodServer,
      nodeEnv: checked?.nodeEnv ?? null,
      compression: checked?.compression ?? null,
    },
  };
}

const run: RunFile = {
  schema: 2,
  meta: {
    date: startedAt,
    host: shortHost(),
    machine: machine(),
    node: process.version,
    versions: {
      lumiose: execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        cwd: REPO,
        encoding: "utf8",
      }).trim(),
      react: versionOf("react", "next"),
      "react-dom": versionOf("react-dom", "next"),
      "react-router": versionOf("react-router", "react-router"),
      next: versionOf("next", "next"),
      "solid-js": versionOf("solid-js", "solid-start"),
      "@solidjs/start": versionOf("@solidjs/start", "solid-start"),
      "@solidjs/router": versionOf("@solidjs/router", "solid-start"),
      nitro: versionOf("nitro", "solid-start"),
      svelte: versionOf("svelte", "sveltekit"),
      "@sveltejs/kit": versionOf("@sveltejs/kit", "sveltekit"),
      "@sveltejs/adapter-node": versionOf("@sveltejs/adapter-node", "sveltekit"),
      nuxt: versionOf("nuxt", "nuxt"),
      vue: versionOf("vue", "nuxt"),
      "vue-router": versionOf("vue-router", "nuxt"),
      nitropack: versionOf("nitropack", "nuxt", "nuxt>@nuxt/nitro-server"),
      vite: (() => {
        const lumioseApp = apps.find((a) => a.id === "lumiose");
        return lumioseApp === undefined ? null : resolvedVersion(lumioseApp, "vite", "lumiose");
      })(),
    },
    iterations,
    quick,
    groups,
    apps: apps.map((app) => app.id),
    conformance,
    servers,
    notes: [
      ...(quick
        ? ["Quick run: one iteration and short load tests; numbers are noisy smoke values."]
        : []),
      `Load: Chromium, CPU throttled ${CPU_THROTTLING}×${values.network ? `, network ${values.network}` : ", no network throttling"}; COMMENTS_DELAY_MS=${env.COMMENTS_DELAY_MS}.`,
      "Payload: bytes of the first load until ready and network idle; gzip level 6, brotli quality 11 computed offline.",
      ...(groups.includes("server")
        ? [
            `Server: rounds interleaved across apps (order rotated each round), each after a ${idle.coolDownMs / 1000} s cool-down and an idle check (1-min load average ≤ ${idle.maxLoadPerCore}/core, waiting up to ${idle.timeoutMs / 1000} s).`,
          ]
        : []),
      ...(busyRounds.length
        ? [`Rounds that started on a busy machine: ${busyRounds.join("; ")}.`]
        : []),
      ...notes,
    ],
  },
  results: recorder.summaries(),
  metrics: recorder.metrics,
};
log(`wrote ${writeRun(run)}`);
