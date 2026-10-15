// The fullstack comparison's methodology page (TASK-317, /benchmarks/fullstack-comparison): every
// committed run of benchmarks/fullstack/results with its machine and scope, and each app's
// implementation with the version and production server the newest run recorded. Read at build time.
import { link, REPOSITORY } from "../lib/site.ts";

/** The fields of a results file's `meta` read here (doc-4 §6). */
interface RunMeta {
  date: string;
  host: string;
  machine: { cpu: string; cores: number; memoryGb?: number; os: string };
  node: string;
  quick: boolean;
  groups?: string[];
  apps: string[];
  conformance?: Record<string, string>;
  versions?: Record<string, string>;
  servers?: Record<string, { prod?: { command: string } }>;
}

const files = import.meta.glob<{ meta: RunMeta }>(
  "../../../../benchmarks/fullstack/results/2*.json",
  { eager: true, import: "default" },
);

export interface Run {
  /** The results file's name, `2026-10-12T162115-macbookpro.json`. */
  file: string;
  /** The file as the site serves it, next to the viewer. */
  url: string;
  /** The file in the repository. */
  source: string;
  meta: RunMeta;
}

/** Every committed run, newest first. */
export function runs(): Run[] {
  return Object.entries(files)
    .map(([path, { meta }]) => {
      const file = path.slice(path.lastIndexOf("/") + 1);
      return {
        file,
        url: link(`/benchmarks/fullstack/results/${file}`),
        source: `${REPOSITORY}/blob/main/benchmarks/fullstack/results/${file}`,
        meta,
      };
    })
    .toSorted((a, b) => b.meta.date.localeCompare(a.meta.date));
}

export interface Implementation {
  /** The app's folder in benchmarks/fullstack/apps. */
  id: string;
  name: string;
  /** The packages whose versions the results record for it, main one first. */
  packages: string[];
  /** How it builds the app, in the framework's own primitives (doc-4 §1). */
  approach: string;
}

/** The apps, in the results' order. */
export const IMPLEMENTATIONS: Implementation[] = [
  {
    id: "lumiose",
    name: "Lumiose",
    packages: ["lumiose"],
    approach:
      "Routes in `server` mode, async components with `<Suspense>` for the streamed comments, form actions, and islands (`client:*`) for the four interactive parts.",
  },
  {
    id: "react-router",
    name: "React Router",
    packages: ["react-router", "react"],
    approach:
      "Framework mode: loaders and actions, `<Form>` and `useFetcher`, a loader promise with `<Await>` inside `<Suspense>`. The whole page hydrates.",
  },
  {
    id: "next",
    name: "Next.js",
    packages: ["next", "react"],
    approach:
      'App Router: server components, server actions, `"use client"` components for the interactive parts, an async server component inside `<Suspense>`.',
  },
  {
    id: "solid-start",
    name: "SolidStart",
    packages: ["@solidjs/start", "solid-js"],
    approach:
      "`query` and `createAsync` server functions, actions with `useSubmission`, a non-deferred `createAsync` inside `<Suspense>`. The whole page hydrates.",
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    packages: ["@sveltejs/kit", "svelte"],
    approach:
      "`+page.server.ts` loads and form actions with `use:enhance`, an un-awaited load promise rendered with `{#await}` (streamed as data). The whole page hydrates.",
  },
  {
    id: "nuxt",
    name: "Nuxt",
    packages: ["nuxt", "vue"],
    approach:
      "`useFetch` from Nitro server routes, `$fetch` mutations with `refresh`, and the comments loaded in the browser, since Vue's server renderer does not stream a fallback. The whole page hydrates.",
  },
  {
    id: "remix",
    name: "Remix 3",
    packages: ["remix"],
    approach:
      "Route maps and controllers, native forms posting to actions, `clientEntry` components for the interactive parts, a `<Frame>` with a fallback for the comments. No build step.",
  },
  {
    id: "astro",
    name: "Astro",
    packages: ["astro", "preact"],
    approach:
      "On-demand rendering, `.astro` pages, forms posting to their own page, Preact islands (`client:load`), and a server island (`server:defer`) for the comments.",
  },
];

export interface ImplementationRow extends Implementation {
  /** `astro 7.3.8 · preact 10.29.8`, from the newest run that recorded versions. */
  versions: string;
  /** The production server command of the newest run, `next start --port …`. */
  server: string | undefined;
  /** The app's source folder. */
  source: string;
}

/** The implementations with the versions and production servers of the newest run. */
export function implementations(): ImplementationRow[] {
  const latest = runs().find((run) => run.meta.versions !== undefined)?.meta;
  return IMPLEMENTATIONS.map((app) => ({
    ...app,
    versions: app.packages
      .filter((name) => latest?.versions?.[name] !== undefined)
      .map((name) =>
        name === "lumiose"
          ? `lumiose ${latest!.versions![name]} (commit)`
          : `${name} ${latest!.versions![name]}`,
      )
      .join(" · "),
    server: latest?.servers?.[app.id]?.prod?.command,
    source: `${REPOSITORY}/tree/main/benchmarks/fullstack/apps/${app.id}`,
  }));
}
