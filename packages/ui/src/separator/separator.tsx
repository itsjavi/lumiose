// Separator (decision-62, TASK-374): a native `<hr>`, after Base UI's Separator. Its implicit role
// is `separator`, horizontal by default; a vertical one gets `aria-orientation="vertical"`. Both
// carry `data-orientation`. No script. An `<hr>` is flow content: it cannot go inside a `<p>`, a
// `<span>` or a `<button>`.

/** Which way a separator runs. */
export type SeparatorOrientation = "horizontal" | "vertical";

/** A native `<hr>`, with every native prop (`class`, `style`, `id`, `aria-*`, `data-*`, …). */
export type SeparatorProps = Omit<JSX.IntrinsicElements["hr"], "children"> & {
  /**
   * Which way the separator runs: `"vertical"` between the items of a row, such as a toolbar's.
   * Default `"horizontal"`.
   */
  orientation?: SeparatorOrientation;
};

/**
 * A line between groups of content, announced as a separator. Unstyled: style it through `class`
 * and `[data-orientation]`.
 *
 * @example
 * <nav class="toolbar">
 *   <a href="/docs">Docs</a>
 *   <Separator orientation="vertical" />
 *   <a href="/blog">Blog</a>
 * </nav>
 */
export function Separator({ orientation, ...rest }: SeparatorProps) {
  const vertical = () => orientation === "vertical";
  return (
    <hr
      {...rest}
      aria-orientation={vertical() ? "vertical" : undefined}
      data-orientation={vertical() ? "vertical" : "horizontal"}
    />
  );
}
