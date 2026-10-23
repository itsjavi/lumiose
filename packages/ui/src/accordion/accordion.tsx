// Accordion (decision-62, TASK-370): Root renders `<lu-accordion>`, and each item is a native
// `<details>` with its `<summary>` as the trigger, so items open and close in server HTML with no
// JavaScript, find-in-page opens them, and one open item at a time is the browser's exclusive
// group (`name`). The element's script (accordion.script.ts) adds the arrow keys, Home and End of
// the APG Accordion pattern and Base UI's animation hooks. The items' `toggle` events are the
// single source of `onValueChange`. Ported from Timeless's approach (https://timeless.build).
import {
  createContext,
  effect,
  onCleanup,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import defineAccordion from "./accordion.script.ts?client";
import type { LuAccordion } from "./accordion.script.ts";
import { batched } from "../batched.ts";
import { notInside } from "../not-inside.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Accordion.Root's element: it moves focus between its items' triggers. */
      "lu-accordion": JSX.HTMLProps<LuAccordion>;
    }
  }
}

/**
 * The element props Root passes to `<lu-accordion>` (`class`, `style`, `data-*`, `aria-*`,
 * events), without the brand of intrinsic elements' props, so that `bind:value` applies to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<LuAccordion> as K extends string ? K : never
  ]: JSX.HTMLProps<LuAccordion>[K];
};

/**
 * `Accordion.Root` renders `<lu-accordion>`, with the element props it is given.
 * `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export interface AccordionRootProps extends Omit<ElementProps, "children"> {
  /**
   * The values of the open items: opens and closes them when it changes. Pair it with
   * `onValueChange` to keep a signal in sync; leave both out and the items keep their own state.
   */
  value?: string[];
  /** The items open at first, when there is no `value`. Default: none. */
  defaultValue?: string[];
  /** Called after an item opens or closes, with the values of the open items. */
  onValueChange?: (value: string[]) => void;
  /** Several items may be open at once. Default `false`: opening one closes the other. */
  multiple?: boolean;
  /** Every item is disabled. */
  disabled?: boolean;
  /** The direction the arrow keys follow. Default `"vertical"`: Up and Down. */
  orientation?: "vertical" | "horizontal";
  /** The arrow keys go from the last trigger to the first and back. Default `true`. */
  loopFocus?: boolean;
  /** The `Accordion.Item`s, right inside it. */
  children?: JSX.Element;
}

/** An item: a `<details>` right inside `Accordion.Root`, with its trigger and its panel. */
export interface AccordionItemProps extends Omit<
  JSX.IntrinsicElements["details"],
  "open" | "name" | "children"
> {
  /** Identifies the item in the root's `value`. Default: an id of its own. */
  value?: string;
  /** Its trigger takes no focus and does not toggle the panel. */
  disabled?: boolean;
  /** Called after the item opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** The `Accordion.Header` with the `Accordion.Trigger`, then the `Accordion.Panel`. */
  children?: JSX.Element;
}

/**
 * The item's heading, an `<h3>`, around the trigger's label. HTML allows a heading in a
 * `<summary>`, not a `<summary>` in a heading, so the `<h3>` is rendered inside the trigger. Set
 * `aria-level` for another level.
 */
export type AccordionHeaderProps = JSX.IntrinsicElements["h3"];
/** The `<summary>` that opens and closes the item: put it inside `Accordion.Header`. */
export type AccordionTriggerProps = JSX.IntrinsicElements["summary"];
/** The `<div role="region">` that the trigger shows and hides, labelled by the trigger. */
export type AccordionPanelProps = JSX.IntrinsicElements["div"];

interface ItemRecord {
  value: string;
  details: () => HTMLDetailsElement | undefined;
}

interface AccordionContextValue {
  id: string;
  multiple: boolean;
  disabled: () => boolean;
  /** Whether `value` starts open. */
  initiallyOpen: (value: string) => boolean;
  items: Signal<ItemRecord[]>;
  /** An item's `toggle` event. */
  onToggle: (value: string, open: boolean) => void;
}

interface ItemContextValue {
  triggerId: string;
  panelId: string;
  disabled: () => boolean;
}

const AccordionContext = createContext<AccordionContextValue>();
const ItemContext = createContext<ItemContextValue>();
/** The props of the `Accordion.Header` around a trigger. */
const HeaderContext = createContext<AccordionHeaderProps>();

function useAccordion(): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw notInside("Accordion parts", "<Accordion.Root>");
  return context;
}

function useItem(): ItemContextValue {
  const context = useContext(ItemContext);
  if (!context) throw notInside("Accordion parts", "an <Accordion.Item>");
  return context;
}

function Root({
  value,
  defaultValue,
  onValueChange,
  multiple,
  disabled,
  orientation,
  loopFocus,
  children,
  ...rest
}: AccordionRootProps) {
  // The arrow keys and the panels' animation hooks; the page loads it once (decision-63).
  defineAccordion();
  const id = useId();
  const several = untrack(() => multiple === true);
  const initial = untrack(() => value ?? defaultValue ?? []);
  /** The open items' values, as the elements last reported or were set to. */
  let open = several ? initial : initial.slice(0, 1);
  const items = signal<ItemRecord[]>([]);
  const context: AccordionContextValue = {
    id,
    multiple: several,
    disabled: () => disabled === true,
    initiallyOpen: (of) => open.includes(of),
    items,
    onToggle: (of, now) => {
      const next = now
        ? [...open.filter((each) => each !== of && context.multiple), of]
        : open.filter((each) => each !== of);
      if (next.length === open.length && next.every((each) => open.includes(each))) return;
      open = next;
      onValueChange?.(next);
    },
  };

  // The `value` prop opens and closes the items when it changes; their `toggle` events report
  // back, so a signal written by `onValueChange` sees the same value again and nothing loops.
  effect(() => {
    const wanted = value;
    if (wanted === undefined) return;
    // The `toggle` events of the changes below then report nothing new.
    open = several ? wanted : wanted.slice(0, 1);
    for (const item of items()) {
      const element = item.details();
      const shown = open.includes(item.value);
      if (element && element.open !== shown) element.open = shown;
    }
  });

  return (
    <AccordionContext value={context}>
      <lu-accordion
        {...rest}
        data-orientation={orientation === "horizontal" ? "horizontal" : undefined}
        data-loop-focus={loopFocus === false ? "false" : undefined}
      >
        {children}
      </lu-accordion>
    </AccordionContext>
  );
}

function Item({
  value,
  disabled,
  onOpenChange,
  children,
  ref: forwarded,
  ...rest
}: AccordionItemProps) {
  const accordion = useAccordion();
  const id = useId();
  // An item keeps the value it started with: it is its identity in the root's `value`.
  const key = untrack(() => value) ?? id;
  const details = ref<HTMLDetailsElement>();
  const record: ItemRecord = { value: key, details };
  accordion.items.update((list) => [...list, record]);
  onCleanup(() => accordion.items.update((list) => list.filter((each) => each !== record)));
  /** The state last reported: a `<details>` created open fires `toggle` too (TASK-441 M40). */
  let shown = accordion.initiallyOpen(key);
  const item: ItemContextValue = {
    triggerId: `${id}-trigger`,
    panelId: `${id}-panel`,
    disabled: () => disabled === true || accordion.disabled(),
  };
  return (
    <ItemContext value={item}>
      <details
        {...rest}
        ref={(element: HTMLDetailsElement) => {
          details(element);
          forwarded?.(element);
        }}
        name={accordion.multiple ? undefined : accordion.id}
        open={shown}
        on:toggle={batched((event: ToggleEvent) => {
          const now = event.newState === "open";
          accordion.onToggle(key, now);
          if (now === shown) return;
          shown = now;
          onOpenChange?.(now);
        })}
      >
        {children}
      </details>
    </ItemContext>
  );
}

function Header({ children, ...rest }: AccordionHeaderProps) {
  return <HeaderContext value={rest}>{children}</HeaderContext>;
}

function Trigger({ children, ...rest }: AccordionTriggerProps) {
  const item = useItem();
  const header = useContext(HeaderContext);
  // A caller's `id` names it; the parts after it point at that (TASK-441 M39).
  if (rest.id) item.triggerId = rest.id;
  return (
    <summary
      {...rest}
      id={item.triggerId}
      aria-controls={item.panelId}
      aria-disabled={item.disabled() ? "true" : undefined}
      tabindex={item.disabled() ? -1 : rest.tabindex}
    >
      {header ? <h3 {...header}>{children}</h3> : children}
    </summary>
  );
}

function Panel({ children, ...rest }: AccordionPanelProps) {
  const item = useItem();
  return (
    <div role="region" {...rest} id={item.panelId} aria-labelledby={item.triggerId}>
      {children}
    </div>
  );
}

/**
 * Accordion: a stack of items whose triggers show and hide their panels, after the APG Accordion
 * pattern. Items are native `<details>` (one open at a time by default, through the browser's
 * exclusive group), so they work in server HTML with no JavaScript; `<lu-accordion>`'s script adds
 * the arrow keys. Unstyled: style the parts through `class`, `[open]` on the items, and the
 * panels' `--lu-accordion-panel-height`, `[data-starting-style]` and `[data-ending-style]`.
 *
 * @example
 * <Accordion.Root defaultValue={["shipping"]}>
 *   <Accordion.Item value="shipping">
 *     <Accordion.Header>
 *       <Accordion.Trigger>Shipping</Accordion.Trigger>
 *     </Accordion.Header>
 *     <Accordion.Panel>Orders ship in two days.</Accordion.Panel>
 *   </Accordion.Item>
 * </Accordion.Root>
 */
export const Accordion = { Root, Item, Header, Trigger, Panel };
