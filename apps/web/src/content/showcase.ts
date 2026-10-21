// The apps, example apps and benchmark pages the showcase lists (TASK-163, TASK-215). The real apps
// live in their own repository and deployment (decision-73); scripts/site.ts builds the samples with
// dummy content below /demos/<slug>/ (noindex) and the benchmark UIs below /benchmarks/; these
// entries describe and link them. ssr-bookshelf needs a server, so it links its code and a screenshot.
import { href } from "lumiose";
import { link, REPOSITORY } from "../lib/site.ts";

export { REPOSITORY };

/** The repository of the Dotmatrix apps, deployed to GitHub Pages at itsjavi.com/dotmatrix/. */
export const DOTMATRIX = "https://github.com/itsjavi/dotmatrix";

export interface Showcase {
  /** Its folder: in examples/ (or benchmarks/) here, or the repository and folder of its own. */
  name: string;
  title: string;
  /** What it shows, in one or two sentences. */
  description: string;
  /** The modes and features it uses. */
  tags: string[];
  /** The running app, on this site or its own; absent when it needs a server. */
  demo?: string;
  /** Its source code. */
  source: string;
  /** A screenshot (public/showcase/<slug>.png). */
  image?: string;
}

/** The real apps, in the itsjavi/dotmatrix repository and on its GitHub Pages (decision-73). */
export function showcase(): Showcase[] {
  return [
    {
      name: "dotmatrix/apps/pocket",
      title: "Dotmatrix Pocket",
      description:
        "A pocket chiptune studio for the four channels of the Game Boy sound chip: a piano roll, presets and sound effects, rendered by the gbaudio engine in a Web Worker.",
      tags: ["mode = spa", "router", ".md imports", "Web Worker"],
      demo: "https://itsjavi.com/dotmatrix/",
      source: `${DOTMATRIX}/tree/main/apps/pocket`,
      image: link("/showcase/dotmatrix.png"),
    },
    {
      name: "dotmatrix/apps/advanced",
      title: "Dotmatrix Advanced",
      description:
        "A chiptune tracker in the browser: an SPA with a persistent layout, an AudioWorklet engine, keyboard-driven editing and a strict Content Security Policy.",
      tags: ["mode = spa", "router", "signals", "CSP"],
      demo: "https://itsjavi.com/dotmatrix/advanced/",
      source: `${DOTMATRIX}/tree/main/apps/advanced`,
      image: link("/showcase/dotmatrix-advanced.png"),
    },
  ];
}

/** Samples with dummy content: at /demos/<slug>/, not indexed. */
export function demos(): Showcase[] {
  return [
    {
      name: "ssg-travel-journal",
      title: "Long Way Round",
      description:
        "A static travel journal from Markdown posts: prerendered pages, tags and pagination, an RSS feed, a search island and cross-document View Transitions.",
      tags: ["mode = static", ".md imports", "islands", "View Transitions"],
      demo: link("/demos/travel-journal/"),
      source: `${REPOSITORY}/tree/main/examples/ssg-travel-journal`,
      image: link("/showcase/travel-journal.png"),
    },
    {
      name: "vite-counter",
      title: "Vite counter",
      description:
        "The smallest setup: @lumiose/vite in a plain Vite app, with a counter and a todo list built from signals and scoped styles.",
      tags: ["@lumiose/vite", "signals", ".stsx"],
      demo: link("/demos/counter/"),
      source: `${REPOSITORY}/tree/main/examples/vite-counter`,
      image: link("/showcase/counter.png"),
    },
    {
      name: "ssr-bookshelf",
      title: "Bookshelf",
      description:
        "A server-rendered book catalogue with accounts, reviews and a reading list on SQLite: streaming SSR, form actions that work without JavaScript, and islands. It needs a Node server, so it does not run here.",
      tags: ["mode = server", "form actions", "islands", "adapter-node"],
      source: `${REPOSITORY}/tree/main/examples/ssr-bookshelf`,
      image: link("/showcase/bookshelf.png"),
    },
  ];
}

export function benchmarks(): Showcase[] {
  return [
    {
      name: "js-framework-benchmark",
      title: "js-framework-benchmark",
      description:
        "krausest's keyed benchmark, run with his own runner against Vanilla JS, Solid, Svelte, Vue Vapor and React: CPU, script time and memory. Try the Lumiose app in your browser.",
      tags: ["client", "CPU", "memory"],
      demo: link("/benchmarks/js-framework-benchmark/"),
      source: `${REPOSITORY}/tree/main/benchmarks/js-framework-benchmark`,
    },
    {
      name: "fullstack",
      title: "Fullstack comparison",
      description:
        "The same issue tracker built with Lumiose and seven other stacks, measured end to end: dev server, build, page load and server throughput. The method, every implementation, the raw results and an interactive viewer.",
      tags: ["dev", "build", "page load", "server"],
      demo: href("/benchmarks/fullstack-comparison"),
      source: `${REPOSITORY}/tree/main/benchmarks/fullstack`,
    },
  ];
}

export interface RenderingMode {
  /** The route option or directive that picks it. */
  option: string;
  title: string;
  /** A few words, for the landing's tiles. */
  summary: string;
  /** One sentence, for the showcase's cards. */
  description: string;
  docs: string;
  /** Live apps that use it. */
  apps: { label: string; href: string; external?: boolean }[];
}

/** The rendering modes in the landing's order (static → islands → server → SPA), with live apps. */
export function renderingModes(): RenderingMode[] {
  const apps = new Map([...showcase(), ...demos()].map((item) => [item.name, item]));
  const live = (name: string) => {
    const item = apps.get(name)!;
    return item.demo === undefined
      ? { label: `${item.title} (source)`, href: item.source, external: true }
      : { label: item.title, href: item.demo };
  };
  return [
    {
      option: "mode = static",
      title: "Static",
      summary: "Prerendered HTML",
      description: "Prerendered at build time to plain HTML files, with staticPaths for params.",
      docs: href("/docs/[[...path]]", { path: "concepts/rendering-modes" }),
      apps: [live("ssg-travel-journal")],
    },
    {
      option: "client:load · idle · visible",
      title: "Islands",
      summary: "Hydrate what moves",
      description:
        "Only interactive components hydrate, with serializable props and slots. This site is static, with islands for the search, the playground and the landing's light.",
      docs: href("/docs/[[...path]]", { path: "concepts/islands" }),
      apps: [{ label: "This site", href: href("/docs/[[...path]]", { path: "" }) }],
    },
    {
      option: "mode = server",
      title: "Server",
      summary: "Streamed per request",
      description:
        "Rendered per request and streamed: the shell first, then each Suspense boundary.",
      docs: href("/docs/[[...path]]", { path: "concepts/rendering-modes" }),
      apps: [live("ssr-bookshelf")],
    },
    {
      option: "mode = spa",
      title: "SPA",
      summary: "Client routing, prerendered first paint",
      description:
        "Client navigation with persistent layouts, where an app needs it, prerendered for a real first render.",
      docs: href("/docs/[[...path]]", { path: "reference/router" }),
      apps: [live("dotmatrix/apps/pocket"), live("dotmatrix/apps/advanced")],
    },
  ];
}
