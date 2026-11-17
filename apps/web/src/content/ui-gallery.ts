// The /ui gallery and the layout of a component page (TASK-614, decision-90), both read from the
// pages @lumiose/ui ships (packages/ui/docs), so a new component appears without a hand edit.
//
// - The gallery lists the pages of the "Components" section of the UI's llms.txt: the package's
//   docs test requires a page there for every exported component. Each cell runs the page's first
//   live demo (its first `tsx check` example that can be one, ./ui-demos.ts).
// - A component page leads with that demo, then its usage beside its props. Usage is the page's
//   import block (the code before its first section) and the snippet of its Anatomy section; the
//   props are the first table of its API section. The rest of the page follows as written. This
//   reads the template every component page follows (decision-64) and adds no authoring syntax.

import { uiPages, type DocBlock, type DocPage } from "./docs.ts";

/** The section of the UI's llms.txt that holds one page per component. */
export const COMPONENTS = "Components";

export type UiDemoRef = NonNullable<Extract<DocBlock, { kind: "code" }>["demo"]>;

export interface GalleryCell {
  page: DocPage;
  /** The page's first live demo. */
  demo: UiDemoRef;
}

/** Whether a UI page documents a component (the others are the overview and the guides). */
export function isComponentPage(page: DocPage): boolean {
  return page.section === COMPONENTS;
}

/** The first live demo of a page, in page order. */
export function firstDemo(page: DocPage): UiDemoRef | undefined {
  for (const block of page.blocks) {
    if (block.kind === "code" && block.demo !== undefined) return block.demo;
  }
  return undefined;
}

/** Every component page with its demo, in the order of the UI's llms.txt. */
export function uiGallery(): GalleryCell[] {
  return uiPages()
    .filter(isComponentPage)
    .map((page) => {
      const demo = firstDemo(page);
      if (demo === undefined) {
        throw new Error(
          `packages/ui/docs/${page.path}.md has no live demo for the /ui gallery: give it a ` +
            "`tsx check` example that exports one component without props.",
        );
      }
      return { page, demo };
    });
}

export interface ComponentLayout {
  /** The demo at the top of the page. */
  demo?: UiDemoRef;
  /** The import block and the Anatomy snippet, as one code sample. */
  usage?: string;
  /** The first table of the API section, as HTML, with the heading it sits under. */
  props?: { html: string; part: string };
  /** The rest of the page: its blocks without the ones that moved into `usage`. */
  blocks: DocBlock[];
}

/** A `##` heading, a `###` heading or a table, in the order a run of HTML has them. */
const LANDMARK =
  /<h2 id="([^"]*)"|<h3 [^>]*>(?:<a class="anchor"[\s\S]*?<\/a>)?([\s\S]*?)<\/h3>|(<div class="table"[^>]*>[\s\S]*?<\/table>\s*<\/div>)/g;

/** The parts of a component page that its head shows, and the blocks left for its body. */
export function componentLayout(page: DocPage): ComponentLayout {
  const usage: string[] = [];
  const blocks: DocBlock[] = [];
  let props: ComponentLayout["props"];
  /** The id of the open `##` section, and the text of the `###` heading open inside it. */
  let section: string | undefined;
  let part = "";
  let imports = false;
  let anatomy = false;
  for (const block of page.blocks) {
    if (block.kind === "html") {
      for (const [, h2, h3, table] of block.html.matchAll(LANDMARK)) {
        if (h2 !== undefined) {
          section = h2;
          part = "";
        } else if (h3 !== undefined) {
          part = h3.replace(/<[^>]+>/g, "").trim();
        } else if (table !== undefined && section === "api" && props === undefined) {
          // The copy at the top of the page is a region of its own, named apart from the API's.
          const name = part === "" ? "Props" : `Props of ${part}`;
          props = { html: table.replace(/aria-label="[^"]*"/, `aria-label="${name}"`), part };
        }
      }
    } else if (block.kind === "code" && block.demo === undefined) {
      // The import block comes before every section; the Anatomy snippet opens its section.
      if (section === undefined && !imports && /^[jt]sx?$/.test(block.lang)) {
        imports = true;
        usage.push(block.code.trim());
        continue;
      }
      if (section === "anatomy" && !anatomy && /^[jt]sx$/.test(block.lang)) {
        anatomy = true;
        usage.push(block.code.trim());
        continue;
      }
    }
    blocks.push(block);
  }
  return {
    demo: firstDemo(page),
    ...(usage.length > 0 ? { usage: usage.join("\n\n") } : {}),
    ...(props === undefined ? {} : { props }),
    blocks,
  };
}
