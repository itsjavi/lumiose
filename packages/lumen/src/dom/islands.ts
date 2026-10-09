// The island loader (owner: Spark; spec §7.2, §7.4, decision-9). `lumen/dom/loader` runs it with
// the app's island manifest; it is split out so tests can pass a manifest of their own.
//
// - Records: `<script type="application/json" data-l-islands>` holds the records of the islands
//   in its chunk (`{ id, ref, strategy, props, value?, slots?, awaits? }`) and `{ id, awaits }`
//   additions for islands whose content streamed later. A MutationObserver picks up each script
//   as the stream arrives; one TreeWalker pass over comments then finds `<!--l:ID-->` and
//   `<!--/l:ID-->` for the new records.
// - Triggers: `load` and `only` at once, `idle` on `requestIdleCallback`, `visible` when the first
//   element of the range intersects the viewport (the value is the `rootMargin`), `media` when the
//   query matches. An island whose range still holds a streamed `<Suspense>` placeholder waits
//   for its content (and the await records sent with it).
// - Hydration: the component comes from the manifest (`ref` → lazy import), then `hydrate()`.
// - Events: `click`, `input`, `submit` and `keydown` targeting an island that is not hydrated yet
//   are stopped (clicks and submits also held back), hydrate it at once, and are dispatched again
//   on their target afterwards; an `input` first restores the value typed meanwhile.
import type { Component } from "../contract/client.ts";
import { decodeData } from "../server/serialize.ts";
import { DEV } from "./dev.ts";
import { hydrate } from "./hydrate.ts";

/** Dev: re-renders the hydrated instances of an edited island module; false when it cannot. */
type HotSwap = (module: string, exports: unknown) => boolean;

/** Island ref (`/src/Counter.stsx#Counter`) → import of the component (`virtual:lumen/islands`). */
export type IslandManifest = Record<string, () => Promise<unknown>>;

interface Island {
  id: number;
  ref: string;
  strategy: string;
  props: unknown;
  value?: string;
  slots?: string[];
  awaits?: Record<string, unknown>;
  /** The range markers, once found. */
  s?: Comment;
  e?: Comment;
  /** Undefined until armed, then 0 (armed), 1 (loading) and 2 (hydrated). */
  g?: number;
  /** Waiting for streamed content inside its range. */
  w?: boolean;
  /** Events caught before hydration, with their target's value at the time. */
  q?: [Event, unknown][];
  /** Dev: disposes the hydrated island (for a hot swap). */
  x?: () => void;
}

/**
 * Starts the loader on the current document. Returns `scan`, which reads records added since
 * (the loader observes the document only while it is loading).
 */
export function loadIslands(manifest: IslandManifest): () => void {
  const islands: Record<number, Island> = {};
  if (DEV) {
    // Hot swap (TASK-147): an edited island module re-renders its hydrated instances on the client
    // from their serialized props; the page and other islands keep their state. False makes the
    // module's accept handler fall back to a reload.
    const hot = ((globalThis as Record<symbol, HotSwap[]>)[Symbol.for("lumen.hot")] ??= []);
    hot.push((module, exports) => {
      let swapped = false;
      for (const id in islands) {
        const island = islands[id]!;
        if (island.g !== 2 || !island.ref.startsWith(`${module}#`)) continue;
        const component = (exports as Record<string, unknown>)[island.ref.slice(module.length + 1)];
        if (typeof component !== "function") return false;
        island.x?.();
        while (island.s!.nextSibling !== island.e) (island.s!.nextSibling as ChildNode).remove();
        island.x = hydrate(
          component as Component<object>,
          decodeData(island.props) as object,
          island.s!,
          island.e!,
          island.awaits,
          island.slots,
          true,
        );
        swapped = true;
      }
      return swapped;
    });
  }

  const scan = (): void => {
    let added = false;
    for (const script of document.querySelectorAll("script[data-l-islands]")) {
      if ((script as { $$l?: boolean }).$$l) {
        continue;
      }
      let records: Island[];
      try {
        records = JSON.parse(script.textContent!);
      } catch {
        // Not fully parsed yet: the next mutation retries.
        continue;
      }
      (script as { $$l?: boolean }).$$l = added = true;
      for (const record of records) {
        const known = islands[record.id];
        if (known === undefined) {
          islands[record.id] = record;
        } else {
          Object.assign((known.awaits ??= {}), record.awaits);
        }
      }
    }
    if (added) {
      find();
    }
  };

  const find = (): void => {
    const walker = document.createTreeWalker(document, 128);
    for (let c: Comment | null; (c = walker.nextNode() as Comment | null) !== null;) {
      const match = /^(\/?)l:(\d+)$/.exec(c.data);
      const island = match === null ? undefined : islands[+match[2]!];
      if (island !== undefined) {
        island[match![1] ? "e" : "s"] = c;
      }
    }
    for (const id in islands) {
      const island = islands[id]!;
      if (island.w) {
        island.w = false;
        go(island);
      } else if (island.e !== undefined && island.g === undefined) {
        arm(island);
      }
    }
  };

  const arm = (island: Island): void => {
    island.g = 0;
    const value = island.value;
    const start = (): void => go(island);
    switch (island.strategy) {
      case "visible": {
        let el = island.s!.nextSibling!;
        while (el !== island.e && el.nodeType !== 1) {
          el = el.nextSibling!;
        }
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              observer.disconnect();
              start();
            }
          },
          { rootMargin: value },
        );
        observer.observe(el === island.e ? island.s!.parentElement! : (el as Element));
        break;
      }
      case "idle":
        (window.requestIdleCallback ?? setTimeout)(start);
        break;
      case "media": {
        const query = matchMedia(value!);
        const check = (): void => {
          if (query.matches) {
            query.removeEventListener("change", check);
            start();
          }
        };
        query.addEventListener("change", check);
        check();
        break;
      }
      default:
        start();
    }
  };

  /**
   * Whether the range still holds a streamed `<Suspense>` placeholder: `<?start name="…">` parses
   * as a processing instruction where the browser patches natively (Chromium), else as a comment.
   */
  const streaming = (island: Island): boolean => {
    // SHOW_PROCESSING_INSTRUCTION | SHOW_COMMENT
    const walker = document.createTreeWalker(island.s!.parentNode!, 192);
    walker.currentNode = island.s!;
    for (let c: Node | null; (c = walker.nextNode()) !== island.e;) {
      if (
        (c as ProcessingInstruction).target === "start" ||
        (c as Comment).data.startsWith("?start")
      ) {
        return true;
      }
    }
    return false;
  };

  const go = (island: Island): void => {
    if (island.g) {
      return;
    }
    if (streaming(island)) {
      island.w = true;
      return;
    }
    island.g = 1;
    const load = manifest[island.ref];
    if (DEV && load === undefined) {
      throw new Error(`Lumen: the island ${island.ref} is missing from virtual:lumen/islands.`);
    }
    void load!().then((component) => {
      const dispose = hydrate(
        component as Component<object>,
        decodeData(island.props) as object,
        island.s!,
        island.e!,
        (island.awaits ??= {}),
        island.slots,
        island.strategy === "only",
      );
      if (DEV) island.x = dispose;
      island.g = 2;
      // Replayed awaits resolve in microtasks: dispatch caught events once they rendered.
      setTimeout(() => replay(island));
      // Islands inside slots this island inserted are in the document now.
      for (const id in islands) {
        if (islands[id]!.e === undefined) {
          return find();
        }
      }
    });
  };

  const replay = (island: Island): void => {
    const queue = island.q ?? [];
    island.q = undefined;
    for (const [event, value] of queue) {
      const target = event.target as HTMLInputElement & HTMLFormElement;
      if (event.type === "submit") {
        target.requestSubmit((event as SubmitEvent).submitter);
      } else {
        if (event.type === "input") {
          target.value = value as string;
        }
        target.dispatchEvent(new (event.constructor as typeof Event)(event.type, event));
      }
    }
  };

  const contains = (island: Island, target: Node): boolean => {
    // `node` runs out when the range left the document (removed by a parent's render).
    for (let node = island.s!.nextSibling; node && node !== island.e; node = node.nextSibling) {
      if (node.contains(target)) {
        return true;
      }
    }
    return false;
  };

  for (const type of ["click", "input", "submit", "keydown"]) {
    document.addEventListener(
      type,
      (event) => {
        for (const id in islands) {
          const island = islands[id]!;
          if (island.g !== 2 && island.e !== undefined && contains(island, event.target as Node)) {
            (island.q ??= []).push([event, (event.target as HTMLInputElement).value]);
            if (type === "click" || type === "submit") {
              event.preventDefault();
            }
            event.stopImmediatePropagation();
            go(island);
            return;
          }
        }
      },
      true,
    );
  }

  scan();
  if (document.readyState === "loading") {
    const observer = new MutationObserver(scan);
    observer.observe(document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", () => {
      observer.disconnect();
      scan();
    });
  }
  return scan;
}
