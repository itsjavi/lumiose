// The example apps and benchmark pages the site publishes (TASK-163, TASK-215). scripts/site.ts
// builds the real apps below /showcase/<slug>/, the samples with dummy content below
// /demos/<slug>/ (noindex) and the benchmark UIs below /benchmarks/; these entries describe and
// link them. ssr-bookshelf needs a server, so it links its code and a screenshot.
import { link, REPOSITORY } from "../lib/site.ts";

export { REPOSITORY };

export interface Showcase {
  name: string;
  title: string;
  /** What it shows, in one or two sentences. */
  description: string;
  /** The modes and features it uses. */
  tags: string[];
  /** The running app on this site; absent when it needs a server. */
  demo?: string;
  /** Its source in the repository. */
  source: string;
  /** A screenshot (public/showcase/<slug>.png). */
  image?: string;
}

/** The real apps: indexed, at /showcase/<slug>/. */
export function showcase(): Showcase[] {
  return [
    {
      name: "spa-chiptune",
      title: "Lumiose Chip",
      description:
        "A chiptune tracker in the browser: an SPA with a persistent layout, an AudioWorklet engine, keyboard-driven editing and a strict Content Security Policy.",
      tags: ["mode = spa", "router", "signals", "CSP"],
      demo: link("/showcase/chiptune-tracker/"),
      source: `${REPOSITORY}/tree/main/examples/spa-chiptune`,
      image: link("/showcase/chiptune-tracker.png"),
    },
    {
      name: "spa-dotmatrix",
      title: "Dotmatrix",
      description:
        "A pocket chiptune studio for the four channels of the Game Boy sound chip: a piano roll, presets and sound effects, rendered by the gbapu engine in a Web Worker.",
      tags: ["mode = spa", "router", ".md imports", "Web Worker"],
      demo: link("/showcase/dotmatrix/"),
      source: `${REPOSITORY}/tree/main/examples/spa-dotmatrix`,
      image: link("/showcase/dotmatrix.png"),
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
        "The same issue tracker built with Lumiose, React Router and Next.js, measured end to end: dev server, build, page load and server throughput, in an interactive results viewer.",
      tags: ["dev", "build", "page load", "server"],
      demo: link("/benchmarks/fullstack/"),
      source: `${REPOSITORY}/tree/main/benchmarks/fullstack`,
    },
  ];
}
