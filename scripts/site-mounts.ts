// The separately built apps the website mounts below its base (TASK-215, TASK-239). scripts/site.ts
// copies them into the site build; apps/web's dev server (apps/web/scripts/dev-mounts.ts) serves
// them from that build, or from each package's own output, so their links work under `lumiose dev`.

export interface Example {
  /** The folder in examples/. */
  name: string;
  /** The built static files, relative to the example. */
  dist: string;
  /** Where the site serves it, relative to the base. */
  path: string;
  /** Real apps are indexed; samples with dummy content get noindex and stay out of the sitemap. */
  indexed: boolean;
}

/** The examples the site publishes: static output, no server. */
export const EXAMPLES: Example[] = [
  { name: "spa-chiptune", dist: "dist/client", path: "showcase/chiptune-tracker/", indexed: true },
  { name: "spa-dotmatrix", dist: "dist/client", path: "showcase/dotmatrix/", indexed: true },
  {
    name: "ssg-travel-journal",
    dist: "dist/client",
    path: "demos/travel-journal/",
    indexed: false,
  },
  { name: "vite-counter", dist: "dist", path: "demos/counter/", indexed: false },
];

export interface Mount {
  /** Where the site serves it, relative to the base (ends with "/"). */
  path: string;
  /** Its name, for the dev page shown while it is not built. */
  title: string;
  /**
   * What fills it, from its package: each repository folder (`at` ends with "/" or is "") or file,
   * at a path relative to the mount.
   */
  files: { at: string; from: string }[];
  /** The command that builds it on its own; absent when only the site build can. */
  build?: string;
  /** Its `pnpm demo <name>`, which runs it on its own. */
  demo?: string;
}

/** Every mount: the examples, then the benchmark UIs (the results pages are apps/web's own). */
export const MOUNTS: Mount[] = [
  ...EXAMPLES.map(({ name, dist, path }) => ({
    path,
    title: name,
    files: [{ at: "", from: `examples/${name}/${dist}` }],
    demo: name,
  })),
  {
    path: "benchmarks/fullstack/",
    title: "the fullstack benchmark viewer",
    files: [
      { at: "", from: "benchmarks/fullstack/viewer" },
      { at: "results/", from: "benchmarks/fullstack/results" },
    ],
  },
  {
    path: "benchmarks/js-framework-benchmark/app/",
    title: "the js-framework-benchmark app",
    files: [
      { at: "", from: "benchmarks/js-framework-benchmark/demo" },
      { at: "main.js", from: "benchmarks/js-framework-benchmark/dist/main.js" },
    ],
    build: "pnpm --filter @lumiose/bench-jsfb build",
  },
];
