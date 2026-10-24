import { signal } from "lumiose";

// Directives next to a spread (TASK-568). `attach` and `bind:` are not props: they apply after the
// spread as they do without one, in either order, and never reach it (where `attach` became an
// attribute holding the function's source); the server drops `attach`. `key` is compile-time
// only. `ref`, handlers and `on:` listeners are props the spread applies, in order with the other
// attributes.
const observe = (el: Element) => el.toggleAttribute("data-seen", true);

export function Row(props: { item: object; i: number; itemProps?: (item: object) => object }) {
  return <li {...props.itemProps?.(props.item)} data-row={props.i} attach={[(el) => observe(el)]} />;
}

export function Before(props: { attrs: object }) {
  return <li attach={[observe]} id="before" {...props.attrs} />;
}

export function Single(props: { attrs: object }) {
  return <li {...props.attrs} attach={observe} />;
}

export function Props(props: { attrs: object; onPick: () => void }) {
  const value = signal("");
  return (
    <input
      key="k"
      {...props.attrs}
      ref={(el) => observe(el)}
      onClick={props.onPick}
      on:custom-event={props.onPick}
      bind:value={value}
      attach={[observe]}
    />
  );
}
