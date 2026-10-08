// `<Link>` (spec §7.5): an `<a href>` that the router navigates on the client (the Navigation API
// and the History fallback intercept plain links too), plus prefetching of the target route's
// modules and `aria-current="page"` on the link to the current page. Its server variant
// (./index.server.ts) renders the same `<a>` with markers for hydration.
import type { Renderable } from "../../contract/client.ts";
import { onCleanup } from "../../core/owner.ts";
import { restProps } from "../../dom/component.ts";
import { listen } from "../../dom/events.ts";
import { insert } from "../../dom/insert.ts";
import { spread } from "../../dom/spread.ts";
import { template } from "../../dom/template.ts";
import type { JSX } from "../../jsx/jsx-runtime.ts";
import { isCurrent, prefetch } from "./router.ts";

/** When `<Link>` loads its route's modules ahead of the click. */
export type Prefetch = "hover" | "viewport" | "none";

export type LinkProps = Omit<JSX.IntrinsicElements["a"], "href" | "children"> & {
  /** The URL; build it with `href()` to type-check the route and its params. */
  href: string;
  /**
   * Load the target route's modules when the pointer enters or the link gets focus (`hover`, the
   * default), when the link enters the viewport (`viewport`), or not (`none`).
   */
  prefetch?: Prefetch;
  children?: JSX.Element;
};

// `<a><!></a>`: the placeholder is where the server's children block hydrates.
const anchor = template("<a><!></a>");
let observer: IntersectionObserver | undefined;

export function Link(props: LinkProps): Renderable {
  const el = anchor() as HTMLAnchorElement;
  const others = restProps(props, ["prefetch", "children"]);
  spread(el, () => ({ ...others, "aria-current": isCurrent(props.href) ? "page" : undefined }));
  insert(el, () => props.children as Renderable, el.firstChild);
  const mode = props.prefetch ?? "hover";
  const load = (): void => prefetch(props.href);
  if (mode === "hover") {
    listen(el, "pointerenter", load, { once: true });
    listen(el, "focus", load, { once: true });
  } else if (mode === "viewport" && typeof IntersectionObserver === "function") {
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer!.unobserve(entry.target);
          prefetch((entry.target as HTMLAnchorElement).href);
        }
      }
    });
    observer.observe(el);
    onCleanup(() => observer!.unobserve(el));
  }
  return el;
}
