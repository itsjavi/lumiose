// The synthetic large app (decision-55, TASK-319): about 1,500 routes across Lumiose's rendering
// modes and about 5,000 components, some of them islands, generated deterministically from a seed:
// the same options always write the same files, byte for byte.
//
//   node scripts/generate.ts <dir> [--routes 1500] [--components 5000] [--seed 1]
//
// Shape (the shares are of `routes`):
//
// - Components `src/components/cNNNN.stsx`, in four levels: a component imports two or three
//   components of the next level, so a page renders a tree four levels deep. Every third
//   component of the last level is an island component (a signal and a click handler), rendered
//   with `client:visible` or `client:idle` by its parent; the others render on the server only.
//   Each file has its own style block.
// - Routes in four sections, each with a layout and folders of 25 routes:
//   `/docs` (55 %, static pages, a fifth with a param and staticPaths()), `/app` (25 %, server
//   pages, a fifth with a param), `/spa` (15 %, spa pages, client-routed) and `/api` (5 %,
//   endpoints, half static and half per request). Each page renders three to five first-level
//   components.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

export interface GenerateOptions {
  /** Routes (pages and endpoints). Default 1500. */
  routes?: number;
  /** Components. Default 5000. */
  components?: number;
  /** PRNG seed. Default 1. */
  seed?: number;
}

export interface GeneratedApp {
  routes: number;
  components: number;
  islands: number;
  /** Server-rendered pages and endpoints (the load of the memory measurement), as URL paths. */
  serverPaths: string[];
  /** A server page and what to edit for the HMR measurement. */
  hmr: { path: string; serverComponent: string; island: string };
  /** The page the dev cold start loads first. */
  firstPage: string;
}

const LEVELS = 4;
const WORDS = [
  "atlas",
  "beacon",
  "cedar",
  "delta",
  "ember",
  "fjord",
  "garnet",
  "harbor",
  "indigo",
  "juniper",
  "kelp",
  "lumen",
  "meadow",
  "nimbus",
  "onyx",
  "prism",
  "quartz",
  "river",
  "summit",
  "tundra",
];

/** mulberry32: a small, fast PRNG; the same seed gives the same sequence on every platform. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(4, "0");
const componentName = (index: number) => `C${pad(index)}`;
const componentFile = (index: number) => `c${pad(index)}.stsx`;

/** Writes the app into `dir` (emptied first) and describes it. */
export function generateApp(dir: string, options: GenerateOptions = {}): GeneratedApp {
  const routeCount = options.routes ?? 1500;
  const componentCount = options.components ?? 5000;
  const random = prng(options.seed ?? 1);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  rmSync(join(dir, "src"), { recursive: true, force: true });
  const write = (file: string, text: string) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  };

  // --- Components --------------------------------------------------------------------------------
  const perLevel = Math.ceil(componentCount / LEVELS);
  const levelOf = (index: number) => Math.min(LEVELS - 1, Math.floor(index / perLevel));
  const range = (level: number): [number, number] => [
    level * perLevel,
    Math.min(componentCount, (level + 1) * perLevel) - 1,
  ];
  const isIsland = (index: number) => levelOf(index) === LEVELS - 1 && index % 3 === 0;
  const childrenOf: number[][] = [];
  let islands = 0;
  for (let index = 0; index < componentCount; index++) {
    const name = componentName(index);
    const level = levelOf(index);
    const word = pick(WORDS);
    const color = `#${between(0, 0xffffff).toString(16).padStart(6, "0")}`;
    const style = `<style>
  .${name.toLowerCase()} {
    padding: ${between(1, 8)}px;
    color: ${color};
  }
  .${name.toLowerCase()} h4 {
    margin: 0;
  }
</style>
`;
    if (isIsland(index)) {
      islands++;
      write(
        `src/components/${componentFile(index)}`,
        `import { signal } from "lumiose";

export function ${name}(props: { label: string; n: number }) {
  const count = signal(props.n);
  return (
    <button class="${name.toLowerCase()}" onClick={() => count.update((value) => value + 1)}>
      ${word} {props.label} {count()}
    </button>
  );
}

${style}`,
      );
      continue;
    }
    const children: number[] = [];
    if (level < LEVELS - 1) {
      const [from, to] = range(level + 1);
      for (let i = between(2, 3); i > 0; i--) children.push(between(from, to));
    }
    const unique = [...new Set(children)];
    childrenOf[index] = unique;
    const imports = unique
      .map((child) => `import { ${componentName(child)} } from "./${componentFile(child)}";`)
      .join("\n");
    const rendered = unique
      .map((child) => {
        const directive = isIsland(child)
          ? random() < 0.5
            ? " client:visible"
            : " client:idle"
          : "";
        return `      <${componentName(child)}${directive} label="${pick(WORDS)}" n={props.n + ${child % 7}} />`;
      })
      .join("\n");
    write(
      `src/components/${componentFile(index)}`,
      `${imports}${imports === "" ? "" : "\n\n"}export function ${name}(props: { label: string; n: number }) {
  return (
    <section class="${name.toLowerCase()}">
      <h4>
        ${word} {props.label}
      </h4>
      <p>Level ${level}, item {props.n}: ${pick(WORDS)} ${pick(WORDS)} ${pick(WORDS)}.</p>
${rendered}
    </section>
  );
}

${style}`,
    );
  }

  /** An island the components `roots` render, directly or below. */
  const islandBelow = (roots: number[]): number | undefined => {
    const queue = [...roots];
    for (const index of queue) {
      if (isIsland(index)) return index;
      queue.push(...(childrenOf[index] ?? []));
    }
    return undefined;
  };

  // --- Routes ------------------------------------------------------------------------------------
  const [firstFrom, firstTo] = range(0);
  const sections = [
    { name: "docs", share: 0.55, mode: "static" },
    { name: "app", share: 0.25, mode: "server" },
    { name: "spa", share: 0.15, mode: "spa" },
    { name: "api", share: 0.05, mode: "endpoint" },
  ] as const;
  const serverPaths: string[] = [];
  let hmr: GeneratedApp["hmr"] | undefined;
  let made = 0;
  write(
    "src/routes/layout.stsx",
    `export default function Root(props: { children?: JSX.Element }) {
  return (
    <div class="root">
      <nav>
        <a href="/">Home</a> <a href="/docs/d00/r0000">Docs</a> <a href="/app/d00/r0000">App</a>
      </nav>
      {props.children}
    </div>
  );
}

<style>
  .root {
    font-family: system-ui;
  }
</style>
`,
  );
  write(
    "src/routes/page.stsx",
    `import { ${componentName(firstFrom)} } from "../components/${componentFile(firstFrom)}";

export default function Home() {
  return (
    <main>
      <h1>Large app</h1>
      <${componentName(firstFrom)} label="home" n={0} />
    </main>
  );
}
`,
  );
  made++;
  for (const [sectionIndex, section] of sections.entries()) {
    const count =
      sectionIndex === sections.length - 1
        ? routeCount - made
        : Math.round(routeCount * section.share);
    const sectionMode =
      section.mode === "static"
        ? ""
        : `export const mode = "${section.mode === "endpoint" ? "server" : section.mode}";\n\n`;
    if (section.mode !== "endpoint") {
      write(
        `src/routes/${section.name}/layout.stsx`,
        `${sectionMode}export default function ${section.name[0]!.toUpperCase()}${section.name.slice(1)}Layout(props: {
  children?: JSX.Element;
}) {
  return <div class="section-${section.name}">{props.children}</div>;
}
`,
      );
    }
    for (let i = 0; i < count; i++, made++) {
      const folder = `src/routes/${section.name}/d${String(Math.floor(i / 25)).padStart(2, "0")}`;
      const param = section.mode !== "spa" && section.mode !== "endpoint" && i % 5 === 4;
      const route = `${folder}/r${pad(i)}${param ? "/[id]" : ""}`;
      const url = `/${section.name}/d${String(Math.floor(i / 25)).padStart(2, "0")}/r${pad(i)}${param ? "/1" : ""}`;
      if (section.mode === "endpoint") {
        const live = i % 2 === 1;
        write(
          `${route}/route.ts`,
          `${live ? 'export const mode = "server";\n\n' : ""}export const GET = () =>
  Response.json({ route: ${i}, words: ${JSON.stringify([pick(WORDS), pick(WORDS)])} });
`,
        );
        if (live) serverPaths.push(url);
        continue;
      }
      const used = [
        ...new Set([1, 2, 3, 4, 5].slice(0, between(3, 5)).map(() => between(firstFrom, firstTo))),
      ];
      const imports = used
        .map(
          (index) =>
            `import { ${componentName(index)} } from "${"../".repeat(route.split("/").length - 1)}components/${componentFile(index)}";`,
        )
        .join("\n");
      const props = param ? "props: { params: { id: string } }" : "";
      const label = param ? "props.params.id" : `"r${pad(i)}"`;
      const paths = param
        ? `\nexport function staticPaths() {
  return [{ params: { id: "1" } }, { params: { id: "2" } }, { params: { id: "3" } }];
}
`
        : "";
      write(
        `${route}/page.stsx`,
        `${imports}
${section.mode === "static" ? paths : ""}
export default function Page${pad(i)}(${props}) {
  return (
    <main>
      <h1>${section.name} ${pick(WORDS)} ${i}</h1>
${used.map((index, n) => `      <${componentName(index)} label={${label}} n={${n}} />`).join("\n")}
    </main>
  );
}
`,
      );
      if (section.mode !== "static") serverPaths.push(url);
      // The HMR measurement edits a server component this page renders and an island it renders.
      const island =
        hmr === undefined && section.mode === "server" && !param ? islandBelow(used) : undefined;
      if (island !== undefined) {
        hmr = {
          path: url,
          serverComponent: `src/components/${componentFile(used[0]!)}`,
          island: `src/components/${componentFile(island)}`,
        };
      }
    }
  }
  write(
    "src/routes/not-found.stsx",
    `export default function NotFound() {
  return <h1>Not found</h1>;
}
`,
  );
  write(
    "vite.config.ts",
    `import lumiose from "@lumiose/vite";

export default { plugins: [lumiose()] };
`,
  );
  write(
    "package.json",
    `${JSON.stringify({ name: "large-app", private: true, type: "module" }, null, 2)}\n`,
  );
  return {
    routes: made,
    components: componentCount,
    islands,
    serverPaths,
    hmr: hmr!,
    firstPage: hmr!.path,
  };
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      routes: { type: "string" },
      components: { type: "string" },
      seed: { type: "string" },
    },
  });
  const dir = positionals[0];
  if (dir === undefined) {
    console.error("Usage: node scripts/generate.ts <dir> [--routes N] [--components N] [--seed N]");
    process.exit(2);
  }
  const app = generateApp(dir, {
    ...(values.routes === undefined ? {} : { routes: Number(values.routes) }),
    ...(values.components === undefined ? {} : { components: Number(values.components) }),
    ...(values.seed === undefined ? {} : { seed: Number(values.seed) }),
  });
  console.log(
    `Generated ${app.routes} routes, ${app.components} components (${app.islands} islands) in ${dir}`,
  );
}
