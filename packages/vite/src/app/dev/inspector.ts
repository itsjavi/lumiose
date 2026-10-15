// The in-page inspector of `lumiose dev` (decision-59, TASK-341), mounted by the dev client unless
// `lumiose({ inspector: false })`. It renders in a closed shadow root, so the app's styles do not
// reach it and the app's tests do not find it (Playwright's locators skip closed shadow roots), from
// the registry the runtime fills in dev (lumiose's dom/devtools.ts, read through
// `globalThis[Symbol.for("lumiose.devtools")]`); it imports nothing from the runtime, so it never
// shows up in what it inspects.
//
// - Alt+Shift+L or the corner button opens it. Panels: Tree (components, props, source),
//   Signals (values, dependents, last write), Islands (strategy, state, timings, failures) and
//   Why did this update (the writes that re-ran a binding or effect). While open, it renders again
//   when the registry changed, at most every REFRESH_MS.
// - Select (the crosshair) picks an element on the page: its component and its bindings.
// - Alt+click opens the clicked element's source (`data-lumiose-source`, written by the compiler
//   in dev) through Vite's open-in-editor endpoint; holding Alt outlines what it would open.
// - Styles go through a constructed stylesheet and the CSSOM, which a strict Content Security
//   Policy (`lumiose({ csp: "strict" })`, `style-src 'nonce-…'`) allows, unlike `<style>` elements
//   and `style` attributes.
import type {
  Cause,
  ComponentRecord,
  IslandRecord,
  ReactiveRecord,
  Registry,
  RunRecord,
} from "lumiose/internal/dom/devtools.ts";
import {
  ago,
  describeNode,
  duration,
  openInEditorUrl,
  preview,
  shortSource,
  SOURCE_ATTRIBUTE,
  writeLocation,
} from "./inspector-format.ts";

export interface InspectorOptions {
  /** The project root, which root-relative source locations are relative to. */
  root: string;
  /** Vite's `base`, where its open-in-editor endpoint is served. */
  base: string;
}

type Tab = "tree" | "signals" | "islands" | "why";

const TABS: readonly [Tab, string][] = [
  ["tree", "Tree"],
  ["signals", "Signals"],
  ["islands", "Islands"],
  ["why", "Why did this update"],
];
const REGISTRY_KEY = Symbol.for("lumiose.devtools");
/** The fastest the open inspector renders again while the page keeps changing. */
const REFRESH_MS = 250;
const RECENT_UPDATES = 30;
const STORAGE_KEY = "lumiose:inspector";

type Child = Node | string | null | undefined | false;

/** Creates an element; `on*` attributes become listeners, strings become text (never HTML). */
function h(
  tag: string,
  attrs: Record<string, string | boolean | ((event: Event) => void) | undefined> = {},
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(name.slice(2), value);
    else el.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
}

function readRegistry(): Registry | undefined {
  return (globalThis as Record<symbol, Registry | undefined>)[REGISTRY_KEY];
}

export interface Inspector {
  /** The inspector's (closed) shadow root, for tests. */
  shadowRoot: ShadowRoot;
  unmount(): void;
}

/** Mounts the inspector on the page. */
export function mountInspector(options: InspectorOptions): Inspector {
  let saved: { open?: boolean; tab?: Tab } = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    // Storage blocked, or not JSON.
  }
  let open = saved.open === true;
  let tab: Tab = TABS.some(([id]) => id === saved.tab) ? saved.tab! : "tree";
  let selected: ComponentRecord | undefined;
  let element: Element | undefined;
  let picking = false;
  /** Whether Signals lists what Lumiose created for the app (a resource's state, the router's URL). */
  let showInternal = false;
  let altDown = false;
  let seen = -1;
  let renderedAt = 0;
  let frame = 0;

  const host = document.createElement("lumiose-inspector");
  const shadow = host.attachShadow({ mode: "closed" });
  const toggle = h(
    "button",
    {
      class: "toggle",
      type: "button",
      title: "Lumiose inspector (Alt+Shift+L)",
      "aria-label": "Lumiose inspector",
      onclick: () => setOpen(!open),
    },
    h("span", { class: "mark", "aria-hidden": "true" }),
  );
  const highlightBox = h("div", { class: "highlight", hidden: true });
  const highlightLabel = h("span", { class: "label" });
  highlightBox.append(highlightLabel);
  const tabButtons = TABS.map(([id, label]) =>
    h("button", { type: "button", role: "tab", onclick: () => setTab(id) }, label),
  );
  const pickButton = h(
    "button",
    {
      class: "pick",
      type: "button",
      title: "Select an element on the page",
      onclick: () => setPicking(!picking),
    },
    "⌖ Select",
  );
  const body = h("div", { class: "body" });
  const panel = h(
    "section",
    { class: "panel", role: "region", "aria-label": "Lumiose inspector", hidden: true },
    h(
      "header",
      {},
      h("span", { class: "title" }, h("span", { class: "mark", "aria-hidden": "true" }), "Lumiose"),
      h("div", { role: "tablist", "aria-label": "Panels" }, ...tabButtons),
      h("span", { class: "spacer" }),
      pickButton,
      h(
        "button",
        {
          class: "close",
          type: "button",
          title: "Close (Alt+Shift+L)",
          "aria-label": "Close the inspector",
          onclick: () => setOpen(false),
        },
        "×",
      ),
    ),
    body,
  );
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(STYLES);
  shadow.adoptedStyleSheets = [sheet];
  shadow.append(highlightBox, panel, toggle);
  document.documentElement.append(host);

  function persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open, tab }));
    } catch {
      // Storage blocked: the inspector starts closed next time.
    }
  }

  function setOpen(next: boolean): void {
    open = next;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.hidden = open;
    if (!open) setPicking(false);
    persist();
    if (open) {
      render();
      frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      hideHighlight();
    }
  }

  function setTab(next: Tab): void {
    tab = next;
    persist();
    render();
  }

  function setPicking(next: boolean): void {
    picking = next;
    pickButton.setAttribute("aria-pressed", String(picking));
    if (!picking) hideHighlight();
  }

  function select(record: ComponentRecord | undefined, el?: Element): void {
    selected = record;
    element = el;
    render();
  }

  function tick(): void {
    frame = requestAnimationFrame(tick);
    const changes = readRegistry()?.changes ?? 0;
    if (changes !== seen && performance.now() - renderedAt >= REFRESH_MS) render();
  }

  function render(): void {
    if (!open) return;
    const registry = readRegistry();
    registry?.prune();
    seen = registry?.changes ?? 0;
    renderedAt = performance.now();
    // A hovered row is about to be replaced, and would never report that the pointer left it.
    if (!picking && !altDown) hideHighlight();
    if (selected !== undefined && registry !== undefined && !inTree(registry.roots, selected)) {
      selected = undefined;
    }
    if (element !== undefined && !element.isConnected) element = undefined;
    for (const [i, [id]] of TABS.entries()) {
      tabButtons[i]!.setAttribute("aria-selected", String(id === tab));
    }
    const scroll = [...body.querySelectorAll(".pane, .scroll")].map((pane) => pane.scrollTop);
    body.replaceChildren(
      registry === undefined
        ? empty(
            "No Lumiose runtime on this page yet: it is server-rendered without islands. Alt+click any element to open its source.",
          )
        : tab === "tree"
          ? treePanel(registry)
          : tab === "signals"
            ? signalsPanel(registry)
            : tab === "islands"
              ? islandsPanel(registry)
              : whyPanel(registry),
    );
    for (const [i, pane] of [...body.querySelectorAll(".pane, .scroll")].entries()) {
      pane.scrollTop = scroll[i] ?? 0;
    }
  }

  // --- Panels ------------------------------------------------------------------------------------

  function treePanel(registry: Registry): Node {
    if (registry.roots.length === 0) {
      return empty(
        "No components run in the browser on this page: server-rendered markup has no client tree. Alt+click any element to open its source.",
      );
    }
    const list = h("ul", { class: "tree", role: "tree", "aria-label": "Components" });
    for (const root of registry.roots) list.append(treeItem(root, 0));
    return h(
      "div",
      { class: "split" },
      h("div", { class: "pane" }, list),
      h("div", { class: "pane details" }, details(registry)),
    );
  }

  function treeItem(record: ComponentRecord, depth: number): Node {
    const row = h(
      "button",
      {
        class: "row",
        type: "button",
        onclick: () => select(record),
        onmouseenter: () => highlight(componentNodes(record), record.name),
        onmouseleave: hideHighlight,
      },
      h("span", { class: "name" }, record.name),
      record.island !== undefined &&
        h("span", { class: "badge" }, `island · ${record.island.strategy}`),
      record.source !== undefined && h("span", { class: "muted" }, shortSource(record.source)),
    );
    row.style.paddingInlineStart = `${8 + depth * 14}px`;
    const item = h("li", { role: "treeitem", "aria-selected": String(record === selected) }, row);
    if (record.children.length > 0) {
      const group = h("ul", { role: "group" });
      for (const child of record.children) group.append(treeItem(child, depth + 1));
      item.append(group);
    }
    return item;
  }

  function details(registry: Registry): Node {
    const record = selected;
    if (record === undefined) {
      return empty("Select a component to see its props, its source and what it owns.");
    }
    const props = registry.snapshot(record);
    const counts = new Map<string, number>();
    for (const r of record.reactive) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    const owns = [...counts].map(([kind, n]) => `${n} ${kind}${n === 1 ? "" : "s"}`).join(", ");
    return h(
      "div",
      {},
      h("h2", {}, record.name),
      record.source === undefined
        ? h("p", { class: "muted" }, "No source location: not compiled by Lumiose in dev.")
        : h("p", {}, sourceLink(record.source)),
      h("h3", {}, "Props"),
      props.length === 0
        ? h("p", { class: "muted" }, "No props.")
        : table(
            ["Prop", "Value"],
            props.map((entry) => [
              entry.key,
              entry.kind === "children"
                ? h("span", { class: "muted" }, "children (not read)")
                : entry.kind === "error"
                  ? `throws ${preview(entry.value)}`
                  : preview(entry.value),
            ]),
          ),
      h("h3", {}, "Owns"),
      h(
        "p",
        {},
        owns || "Nothing reactive.",
        " ",
        record.reactive.length > 0 &&
          h(
            "button",
            { type: "button", class: "link", onclick: () => setTab("signals") },
            "Signals →",
          ),
      ),
      record.island !== undefined && h("h3", {}, "Island"),
      record.island !== undefined && h("p", {}, islandSummary(record.island)),
    );
  }

  function signalsPanel(registry: Registry): Node {
    const records = selected?.reactive ?? registry.global;
    const all = records.filter((r) => r.kind !== "effect" && r.kind !== "binding");
    const values = showInternal ? all : all.filter((r) => !r.internal);
    const hidden = all.length - values.length;
    const runs = records.filter((r) => r.kind === "effect" || r.kind === "binding");
    const now = performance.now();
    return h(
      "div",
      { class: "scroll" },
      h(
        "p",
        {},
        selected === undefined
          ? "Signals created outside components (module scope, event handlers). Select a component in Tree for its own."
          : `Created by ${selected.name}. `,
        selected !== undefined &&
          h(
            "button",
            { type: "button", class: "link", onclick: () => select(undefined) },
            "Outside components →",
          ),
      ),
      values.length === 0
        ? h("p", { class: "muted" }, "No signals.")
        : table(
            ["Signal", "Value", "Dependents", "Last write"],
            values.map((r) => {
              const { value, stale } = registry.valueOf(r);
              const dependents = registry.dependents(r);
              return [
                h(
                  "span",
                  { class: r.internal ? "internal" : undefined },
                  nameOf(r),
                  " ",
                  h("span", { class: "badge" }, r.internal ? `lumiose ${r.kind}` : r.kind),
                ),
                r.kind === "store" || r.kind === "trigger"
                  ? h("span", { class: "muted" }, "–")
                  : `${preview(value)}${stale ? " (stale)" : ""}`,
                dependents.length === 0
                  ? h("span", { class: "muted" }, "none")
                  : dependents.map((d) => (d === undefined ? "async run" : nameOf(d))).join(", "),
                r.write === undefined
                  ? h("span", { class: "muted" }, "never written")
                  : writeText(r, now),
              ];
            }),
          ),
      (hidden > 0 || showInternal) &&
        h(
          "button",
          {
            type: "button",
            class: "link",
            onclick: () => {
              showInternal = !showInternal;
              render();
            },
          },
          showInternal
            ? "Hide Lumiose's own signals"
            : `Show Lumiose's own signals (${hidden}): resources, boundaries, the router`,
        ),
      h("h3", {}, "Effects and bindings"),
      runs.length === 0
        ? h("p", { class: "muted" }, "None.")
        : table(
            ["Node", "Value", "Runs", "Last update"],
            runs.map((r) => [
              nameOf(r),
              runValue(registry, r),
              String(r.runs),
              r.run === undefined || (r.run.causes.length === 0 && r.runs <= 1)
                ? h("span", { class: "muted" }, "not updated")
                : causesText(r.run, now),
            ]),
          ),
    );
  }

  function islandsPanel(registry: Registry): Node {
    if (registry.islands.length === 0) return empty("No islands on this page.");
    return h(
      "div",
      { class: "scroll" },
      table(
        ["Island", "Strategy", "State", "Armed", "Load", "Hydrate", "Error"],
        registry.islands.map((island) => [
          h(
            "button",
            {
              type: "button",
              class: "link",
              title: island.ref,
              onclick: () => {
                if (island.component !== undefined) {
                  selected = island.component;
                  setTab("tree");
                }
              },
              onmouseenter: () => highlight(islandNodes(island), island.ref),
              onmouseleave: hideHighlight,
            },
            island.ref.split("#")[1] ?? island.ref,
          ),
          island.value === undefined ? island.strategy : `${island.strategy} (${island.value})`,
          h("span", { class: `state ${island.state}` }, island.state),
          island.armed === undefined ? "–" : `${island.armed.toFixed(0)} ms`,
          duration(island.loading, island.loaded),
          duration(island.loaded, island.hydrated),
          island.state === "failed" || island.error !== undefined
            ? h("span", { class: "error" }, preview(island.error))
            : "",
        ]),
      ),
      h(
        "p",
        { class: "muted" },
        "Armed: when the loader found the island, in ms since navigation started. Load: its module; Hydrate: claiming the server's nodes.",
      ),
    );
  }

  function whyPanel(registry: Registry): Node {
    const now = performance.now();
    const intro = h(
      "p",
      {},
      element === undefined
        ? "Select an element (⌖ Select) to see the writes that updated it, or read the latest updates below."
        : h(
            "span",
            {},
            "Selected ",
            h("code", {}, describeNode(element)),
            selected !== undefined ? ` in ${selected.name}` : "",
            ". ",
          ),
    );
    const bindings = element === undefined ? [] : registry.bindingsOf(element);
    const effects = (selected?.reactive ?? []).filter((r) => r.kind === "effect");
    const own =
      element === undefined
        ? null
        : bindings.length + effects.length === 0
          ? h("p", { class: "muted" }, "Nothing updates this element: it is static.")
          : table(
              ["Node", "Value", "Runs", "Why it last updated"],
              [...bindings, ...effects].map((r) => [
                nameOf(r),
                runValue(registry, r),
                String(r.runs),
                r.run === undefined || (r.run.causes.length === 0 && r.runs <= 1)
                  ? h("span", { class: "muted" }, "not updated since it rendered")
                  : causesText(r.run, now),
              ]),
            );
    const recent = registry.updates.slice(-RECENT_UPDATES).toReversed();
    return h(
      "div",
      { class: "scroll" },
      intro,
      own,
      h("h3", {}, "Latest updates"),
      recent.length === 0
        ? h("p", { class: "muted" }, "Nothing updated yet.")
        : table(
            ["Node", "Why"],
            recent.map((run) => [nameOf(run.record), causesText(run, now)]),
          ),
    );
  }

  // --- Pieces ------------------------------------------------------------------------------------

  function nameOf(record: ReactiveRecord): string {
    const name =
      record.label ??
      (record.kind === "binding" && record.host !== undefined
        ? `binding of ${describeNode(record.host)}`
        : `${record.kind} #${record.id}`);
    return record.component === undefined || record.component === selected
      ? name
      : `${name} in ${record.component.name}`;
  }

  /** What a binding last wrote (an effect has no value). */
  function runValue(registry: Registry, record: ReactiveRecord): Node | string {
    return record.kind === "binding"
      ? preview(registry.valueOf(record).value, 40)
      : h("span", { class: "muted" }, "–");
  }

  function writeText(record: ReactiveRecord, now: number): Node {
    const write = record.write!;
    const where = writeLocation(write.where);
    return h(
      "span",
      {},
      record.kind === "signal"
        ? `${preview(write.previous, 40)} → ${preview(write.value, 40)}`
        : "changed",
      h("span", { class: "muted" }, ` · ${ago(write.time, now)}${where ? ` · ${where}` : ""}`),
    );
  }

  function causesText(run: RunRecord, now: number): Node {
    if (run.causes.length === 0) {
      return h(
        "span",
        { class: "muted" },
        `${ago(run.time, now)}: no recorded write (an untracked change)`,
      );
    }
    return h(
      "span",
      {},
      ...run.causes.map((cause, i) => causeText(cause, i > 0)),
      h("span", { class: "muted" }, ` · ${ago(run.time, now)}`),
    );
  }

  function causeText(cause: Cause, separate: boolean): Node {
    const chain = [...cause.via.map((r) => r.label ?? `computed #${r.id}`), nameOf(cause.source)];
    const write = cause.write;
    const where = writeLocation(write.where);
    return h(
      "span",
      { class: "cause" },
      separate ? "; " : "",
      chain.join(" ← "),
      cause.source.kind === "signal"
        ? `: ${preview(write.previous, 40)} → ${preview(write.value, 40)}`
        : "",
      where ? h("span", { class: "muted" }, ` in ${where}`) : "",
    );
  }

  function sourceLink(source: string): Node {
    return h(
      "button",
      {
        type: "button",
        class: "link source",
        title: "Open in your editor",
        onclick: () => openSource(source),
      },
      source,
    );
  }

  function openSource(source: string): void {
    void fetch(openInEditorUrl(options.base, options.root, source)).catch(() => {});
  }

  // --- Highlight, picking and Alt+click ---------------------------------------------------------

  function highlight(nodes: Node[], label: string): void {
    let top = Infinity;
    let left = Infinity;
    let bottom = -Infinity;
    let right = -Infinity;
    for (const node of nodes) {
      if (!node.isConnected) continue;
      let rect: DOMRect;
      if (node.nodeType === 1) rect = (node as Element).getBoundingClientRect();
      else {
        const range = document.createRange();
        range.selectNode(node);
        rect = range.getBoundingClientRect();
      }
      if (rect.width === 0 && rect.height === 0) continue;
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      bottom = Math.max(bottom, rect.bottom);
      right = Math.max(right, rect.right);
    }
    if (top === Infinity) {
      hideHighlight();
      return;
    }
    Object.assign(highlightBox.style, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
    });
    highlightLabel.textContent = label;
    highlightBox.hidden = false;
  }

  function hideHighlight(): void {
    highlightBox.hidden = true;
  }

  /** The page element under an event, or undefined for the inspector itself. */
  function pageTarget(event: Event): Element | undefined {
    const target = event.target;
    return target instanceof Element && target !== host ? target : undefined;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code === "KeyL" &&
      event.altKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      setOpen(!open);
    } else if (event.key === "Escape" && picking) {
      setPicking(false);
    } else if (event.key === "Alt") {
      altDown = true;
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Alt") {
      altDown = false;
      if (!picking) hideHighlight();
    }
  };
  const onMove = (event: MouseEvent): void => {
    const target = pageTarget(event);
    if (picking) {
      if (target !== undefined) highlight([target], describeNode(target));
    } else if (event.altKey || altDown) {
      const located = target?.closest(`[${SOURCE_ATTRIBUTE}]`);
      const source = located?.getAttribute(SOURCE_ATTRIBUTE);
      if (located && source) highlight([located], shortSource(source));
      else hideHighlight();
    }
  };
  const onClick = (event: MouseEvent): void => {
    const target = pageTarget(event);
    if (target === undefined) return;
    if (picking) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPicking(false);
      const registry = readRegistry();
      select(registry === undefined ? undefined : componentAt(registry.roots, target), target);
      if (tab === "islands") setTab("tree");
      return;
    }
    if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      const source = target.closest(`[${SOURCE_ATTRIBUTE}]`)?.getAttribute(SOURCE_ATTRIBUTE);
      if (!source) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hideHighlight();
      openSource(source);
    }
  };
  const onScroll = (): void => hideHighlight();
  const onBlur = (): void => {
    altDown = false;
    if (!picking) hideHighlight();
  };
  // On window, in the capture phase: before the island loader's document listeners, which hold
  // back clicks on islands that did not hydrate yet.
  addEventListener("keydown", onKeyDown, true);
  addEventListener("keyup", onKeyUp, true);
  addEventListener("mousemove", onMove, true);
  addEventListener("click", onClick, true);
  addEventListener("scroll", onScroll, { capture: true, passive: true });
  addEventListener("blur", onBlur);

  setOpen(open);

  const unmount = (): void => {
    cancelAnimationFrame(frame);
    removeEventListener("keydown", onKeyDown, true);
    removeEventListener("keyup", onKeyUp, true);
    removeEventListener("mousemove", onMove, true);
    removeEventListener("click", onClick, true);
    removeEventListener("scroll", onScroll, true);
    removeEventListener("blur", onBlur);
    host.remove();
  };
  return { shadowRoot: shadow, unmount };
}

function islandSummary(island: IslandRecord): string {
  return `${island.ref}: ${island.strategy}, ${island.state}, load ${duration(island.loading, island.loaded)}, hydrate ${duration(island.loaded, island.hydrated)}`;
}

function empty(text: string): Node {
  return h("p", { class: "empty" }, text);
}

function table(headings: string[], rows: Child[][]): Node {
  return h(
    "table",
    {},
    h("thead", {}, h("tr", {}, ...headings.map((text) => h("th", { scope: "col" }, text)))),
    h("tbody", {}, ...rows.map((cells) => h("tr", {}, ...cells.map((cell) => h("td", {}, cell))))),
  );
}

function inTree(records: ComponentRecord[], record: ComponentRecord): boolean {
  return records.some((r) => r === record || inTree(r.children, record));
}

/** What a component rendered, or what its children and bindings did when it returned no nodes. */
function componentNodes(record: ComponentRecord): Node[] {
  if (record.nodes.length > 0) return record.nodes;
  const nodes = record.children.flatMap(componentNodes);
  for (const r of record.reactive) if (r.host !== undefined) nodes.push(r.host);
  return nodes;
}

/** The deepest component whose nodes contain `target`. */
function componentAt(records: ComponentRecord[], target: Node): ComponentRecord | undefined {
  for (const record of records) {
    const nodes = componentNodes(record);
    if (nodes.some((node) => node === target || node.contains(target))) {
      return componentAt(record.children, target) ?? record;
    }
    const nested = record.nodes.length === 0 ? componentAt(record.children, target) : undefined;
    if (nested !== undefined) return nested;
  }
  return undefined;
}

/** The nodes between an island's range markers. */
function islandNodes(island: IslandRecord): Node[] {
  const nodes: Node[] = [];
  if (island.start === undefined || island.end === undefined) return nodes;
  for (
    let node = island.start.nextSibling;
    node !== null && node !== island.end;
    node = node.nextSibling
  ) {
    nodes.push(node);
  }
  return nodes;
}

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.toggle, .panel, .highlight {
  --bg: #ffffff; --fg: #18181f; --muted: #6b6b7b; --line: #e4e4ee; --soft: #f4f3ff;
  --accent: #5546ff; --accent-text: #4a3af2; --ok: #157f3b; --warn: #a15c00; --bad: #c4231c;
  font: 12px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--fg);
}
@media (prefers-color-scheme: dark) {
  .toggle, .panel, .highlight {
    --bg: #14141c; --fg: #ececf3; --muted: #9a9aab; --line: #2b2b38; --soft: #1c1940;
    --accent: #8f84ff; --accent-text: #a99fff; --ok: #5bd28a; --warn: #f0b45c; --bad: #ff7a72;
  }
}
[hidden] { display: none !important; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-radius: 4px; }
.mark {
  display: inline-block; inline-size: 14px; block-size: 14px; border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, #fff 0 14%, transparent 42%), linear-gradient(135deg, #7c6cff, #ffb547);
  box-shadow: 0 0 6px color-mix(in oklab, #7c6cff 55%, transparent);
}
.toggle {
  position: fixed; inset-block-end: 12px; inset-inline-start: 12px; z-index: 2147483646;
  inline-size: 34px; block-size: 34px; border-radius: 50%; display: grid; place-items: center;
  background: var(--bg); border: 1px solid var(--line); box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
  opacity: 0.7; transition: opacity 0.15s;
}
.toggle:hover, .toggle:focus-visible { opacity: 1; }
.toggle .mark { inline-size: 16px; block-size: 16px; }
.panel {
  position: fixed; inset-inline: 0; inset-block-end: 0; z-index: 2147483646; block-size: 42vh;
  min-block-size: 220px; display: flex; flex-direction: column; background: var(--bg);
  border-block-start: 1px solid var(--line); box-shadow: 0 -4px 18px rgb(0 0 0 / 0.14);
}
header {
  display: flex; align-items: center; gap: 4px; padding: 4px 8px;
  border-block-end: 1px solid var(--line); flex-wrap: wrap;
}
.title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; margin-inline-end: 8px; }
[role="tablist"] { display: flex; gap: 2px; flex-wrap: wrap; }
[role="tab"], .pick { padding: 4px 8px; border-radius: 6px; color: var(--muted); }
[role="tab"]:hover, .pick:hover { color: var(--fg); background: var(--soft); }
[role="tab"][aria-selected="true"] { color: var(--accent-text); background: var(--soft); font-weight: 600; }
.pick[aria-pressed="true"] { color: var(--bg); background: var(--accent); }
.spacer { flex: 1; }
.close { font-size: 18px; line-height: 1; padding: 2px 8px; color: var(--muted); }
.close:hover { color: var(--fg); }
.body { flex: 1; min-block-size: 0; display: flex; }
.body > * { flex: 1; min-inline-size: 0; }
.split { display: flex; min-block-size: 0; }
.pane { flex: 1; overflow: auto; padding: 6px 0; min-inline-size: 0; }
.pane.details { flex: 1.3; padding: 8px 12px; border-inline-start: 1px solid var(--line); }
.scroll { overflow: auto; padding: 8px 12px; }
.empty { margin: auto; padding: 24px; color: var(--muted); max-inline-size: 60ch; text-align: center; }
ul { list-style: none; margin: 0; padding: 0; }
.row {
  display: flex; align-items: baseline; gap: 6px; inline-size: 100%; text-align: start;
  padding-block: 2px; padding-inline-end: 8px; white-space: nowrap;
}
.row:hover { background: var(--soft); }
[aria-selected="true"] > .row { background: var(--soft); box-shadow: inset 2px 0 var(--accent); }
.name { font-weight: 600; color: var(--accent-text); }
.muted, .internal { color: var(--muted); }
.badge {
  font-size: 10px; padding: 0 5px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted);
  white-space: nowrap;
}
h2 { font-size: 14px; margin: 0 0 2px; }
h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin: 12px 0 4px; }
p { margin: 4px 0; }
code { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.link { color: var(--accent-text); text-decoration: underline; text-underline-offset: 2px; }
.source { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; text-align: start; }
table { border-collapse: collapse; inline-size: 100%; }
th, td { text-align: start; vertical-align: top; padding: 3px 8px 3px 0; border-block-end: 1px solid var(--line); }
th { font-weight: 600; color: var(--muted); font-size: 11px; }
td { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; overflow-wrap: anywhere; }
td:first-child { inline-size: 28%; }
.state { font-weight: 600; }
.state.hydrated { color: var(--ok); }
.state.waiting, .state.loading, .state.hydrating { color: var(--warn); }
.state.failed, .error { color: var(--bad); }
.highlight {
  position: fixed; z-index: 2147483645; pointer-events: none; border: 1.5px solid var(--accent);
  background: color-mix(in oklab, var(--accent) 14%, transparent); border-radius: 3px;
}
.label {
  position: absolute; inset-block-end: 100%; inset-inline-start: -1.5px; margin-block-end: 2px;
  padding: 1px 6px; border-radius: 4px; background: var(--accent); color: #fff; white-space: nowrap;
  font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
}
`;
