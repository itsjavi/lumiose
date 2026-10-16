// Collapsible (decision-62, TASK-370): a native `<details>`, so its trigger (the `<summary>`)
// opens and closes the panel in server HTML with no JavaScript, with the browser's own keyboard
// handling and expanded state, and find-in-page opens it. The element is the only state: the
// trigger, find-in-page and the `open` prop all end in its `toggle` event, the single source of
// `onOpenChange`. The client script (./panel.ts) adds Base UI's animation hooks and the disabled
// trigger. Ported from Timeless's approach (https://timeless.build).
import { createContext, effect, ref, untrack, useContext, useId } from "lumiose";
import collapsibleScript from "./collapsible.script.ts?client";

/**
 * The `<details>` props Root passes on (`class`, `style`, `name`, `data-*`, `aria-*`, events),
 * without the brand of intrinsic elements' props, so that `bind:open` applies to Root.
 */
type DetailsProps = {
  [
    K in keyof JSX.IntrinsicElements["details"] as K extends string ? K : never
  ]: JSX.IntrinsicElements["details"][K];
};

/**
 * `Collapsible.Root` renders the `<details>`, with the element props it is given.
 * `bind:open={signal}` stands in for `open` and `onOpenChange`.
 */
export interface CollapsibleRootProps extends Omit<DetailsProps, "open" | "children"> {
  /**
   * Opens (`true`) or closes (`false`) the panel when it changes. Pair it with `onOpenChange` to
   * keep a signal in sync; leave both out and the element keeps its own state. Server HTML starts
   * as it says.
   */
  open?: boolean;
  /** Whether the panel starts open, when there is no `open`. Default `false`. */
  defaultOpen?: boolean;
  /** Called after the panel opens or closes, whatever opened or closed it. */
  onOpenChange?: (open: boolean) => void;
  /** The trigger takes no focus and does not toggle the panel. */
  disabled?: boolean;
  /** The other parts: the `Collapsible.Trigger` first, then the `Collapsible.Panel`. */
  children?: JSX.Element;
}

/** The `<summary>` that opens and closes the panel: the first child of `Collapsible.Root`. */
export type CollapsibleTriggerProps = JSX.IntrinsicElements["summary"];
/** The `<div>` that the trigger shows and hides. */
export type CollapsiblePanelProps = JSX.IntrinsicElements["div"];

interface CollapsibleContextValue {
  triggerId: string;
  panelId: string;
  disabled: () => boolean;
}

const CollapsibleContext = createContext<CollapsibleContextValue>();

function useCollapsible(): CollapsibleContextValue {
  const context = useContext(CollapsibleContext);
  if (!context) throw new Error("Collapsible parts must be inside <Collapsible.Root>.");
  return context;
}

function Root({
  open,
  defaultOpen,
  onOpenChange,
  disabled,
  children,
  ref: forwarded,
  ...rest
}: CollapsibleRootProps) {
  // The panel's animation hooks and the disabled trigger; the page loads it once (decision-63).
  collapsibleScript();
  const id = useId();
  const details = ref<HTMLDetailsElement>();
  const context: CollapsibleContextValue = {
    triggerId: `${id}-trigger`,
    panelId: `${id}-panel`,
    disabled: () => disabled === true,
  };

  // The `open` prop drives the element; its `toggle` event reports back, so a signal written by
  // `onOpenChange` sees the same value again and nothing loops.
  effect(() => {
    const element = details();
    const wanted = open;
    if (element && wanted !== undefined && element.open !== wanted) element.open = wanted;
  });

  return (
    <CollapsibleContext value={context}>
      <details
        {...rest}
        ref={(element: HTMLDetailsElement) => {
          details(element);
          forwarded?.(element);
        }}
        open={untrack(() => open ?? defaultOpen) === true}
        on:toggle={(event: ToggleEvent) => onOpenChange?.(event.newState === "open")}
      >
        {children}
      </details>
    </CollapsibleContext>
  );
}

// The parts spread the caller's props first, so they override the defaults, and set the wiring
// last, so the ids that connect them stay consistent.

function Trigger({ children, ...rest }: CollapsibleTriggerProps) {
  const collapsible = useCollapsible();
  return (
    <summary
      {...rest}
      id={collapsible.triggerId}
      aria-controls={collapsible.panelId}
      aria-disabled={collapsible.disabled() ? "true" : undefined}
      tabindex={collapsible.disabled() ? -1 : rest.tabindex}
    >
      {children}
    </summary>
  );
}

function Panel({ children, ...rest }: CollapsiblePanelProps) {
  const collapsible = useCollapsible();
  return (
    <div {...rest} id={collapsible.panelId}>
      {children}
    </div>
  );
}

/**
 * A panel that its trigger shows and hides: a native `<details>`, so it works in server HTML with
 * no JavaScript, and find-in-page opens it. Unstyled: style the parts through `class`, `[open]` on
 * the root, and the panel's `--lu-collapsible-panel-height`, `[data-starting-style]` and
 * `[data-ending-style]` for an animation.
 *
 * @example
 * <Collapsible.Root>
 *   <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
 *   <Collapsible.Panel>…</Collapsible.Panel>
 * </Collapsible.Root>
 */
export const Collapsible = { Root, Trigger, Panel };
