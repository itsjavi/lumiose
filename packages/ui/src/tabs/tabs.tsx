// Tabs (decision-62, TASK-359): Root renders `<lu-tabs>`, a light-DOM element whose script
// (tabs.script.ts) adds the keyboard and the selection to the server HTML, which already carries
// the full APG state: roles, `aria-selected`, the roving `tabindex`, `aria-controls` and
// `aria-labelledby`, and `hidden` on the other panels. The element's DOM is the state: the
// component renders it, `value` drives it when it changes, and the element's `valuechange` event
// reports back through `onValueChange`.
import {
  createContext,
  effect,
  isServer,
  onCleanup,
  ref,
  signal,
  untrack,
  useContext,
  useId,
  type Signal,
} from "lumiose";
import { withStyle } from "../placement/placement.ts";
import defineTabs from "./tabs.script.ts?client";
import type { LuTabs } from "./tabs.script.ts";
import { batched } from "../batched.ts";
import { notInside } from "../not-inside.ts";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /** Tabs.Root's element: `value` is the selected tab's, `valuechange` reports a change. */
      "lu-tabs": JSX.HTMLProps<LuTabs> & {
        /** The selected tab's value, `null` when none is; setting it selects that tab. */
        value?: string | null;
        /** Sets `value` from the signal; the element's `valuechange` writes it back. */
        "bind:value"?: Signal<string | null>;
      };
    }
  }
}

/**
 * The element props Root passes to `<lu-tabs>` (`class`, `style`, `data-*`, `aria-*`, events),
 * without the brand of intrinsic elements' props, so that `bind:value` applies to Root.
 */
type ElementProps = {
  [K in keyof JSX.HTMLProps<LuTabs> as K extends string ? K : never]: JSX.HTMLProps<LuTabs>[K];
};

/**
 * `Tabs.Root` renders `<lu-tabs>`, with the element props it is given. `bind:value={signal}`
 * stands in for `value` and `onValueChange`.
 */
export interface TabsRootProps extends Omit<ElementProps, "children"> {
  /**
   * Selects the tab with this value when it changes. Pair it with `onValueChange` to keep a signal
   * in sync; leave both out and the tabs keep their own state.
   */
  value?: string;
  /** The tab selected at first, when there is no `value`. Default: the first enabled tab. */
  defaultValue?: string;
  /** Called after the user selects another tab, with its value. */
  onValueChange?: (value: string) => void;
  /** The tab list's direction, for the arrow keys. Default `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** The other parts: the `Tabs.List` and the `Tabs.Panel`s. */
  children?: JSX.Element;
}

/** The `<div role="tablist">` around the tabs. Name it with `aria-label` or `aria-labelledby`. */
export type TabsListProps = JSX.IntrinsicElements["div"] & {
  /** Selecting a tab when it receives focus (automatic activation). Default `false`: manual. */
  activateOnFocus?: boolean;
  /** The arrow keys go from the last tab to the first and back. Default `true`. */
  loopFocus?: boolean;
};

/** A `<button role="tab">`, paired with the `Tabs.Panel` of the same `value`. */
export type TabsTabProps = Omit<JSX.IntrinsicElements["button"], "value"> & {
  /** Identifies the tab and its panel. */
  value: string;
  /** Takes focus but cannot be selected. */
  disabled?: boolean;
};

/** A `<div role="tabpanel">`, shown while the tab of the same `value` is selected. */
export type TabsPanelProps = JSX.IntrinsicElements["div"] & {
  /** The value of the tab that shows the panel. */
  value: string;
};

/**
 * A `<span aria-hidden="true" data-indicator>` inside `Tabs.List` that covers the selected tab's
 * box, placed from the server HTML on: style it as an underline or a highlight that slides from
 * tab to tab.
 */
export type TabsIndicatorProps = Omit<JSX.IntrinsicElements["span"], "children">;

interface TabRecord {
  value: string;
  disabled: () => boolean;
}

interface TabsContextValue {
  /** The selected value: a disabled or missing tab gives its place to the first enabled one. */
  current: () => string | undefined;
  /** The value asked for (`value`, `defaultValue` or the user's choice), even a disabled tab's. */
  wanted: () => string | undefined;
  tabs: Signal<TabRecord[]>;
  orientation: () => "horizontal" | "vertical";
  tabId: (value: string) => string;
  /** Records a Tab's own `id`: the Panel after it points at it. */
  name: (value: string, id: string) => void;
  panelId: (value: string) => string;
}

const TabsContext = createContext<TabsContextValue>();

function useTabs(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw notInside("Tabs parts", "<Tabs.Root>");
  return context;
}

/** An id fragment for a value: ids may not hold spaces. */
const fragment = (value: string) => encodeURIComponent(value).replaceAll("%", "_");

function Root({
  value,
  defaultValue,
  onValueChange,
  orientation,
  children,
  ...rest
}: TabsRootProps) {
  // Keyboard and selection on the server HTML; the page loads it once (decision-63).
  defineTabs();
  const id = useId();
  const element = ref<LuTabs>();
  const selected = signal<string | undefined>(untrack(() => value ?? defaultValue));
  const tabs = signal<TabRecord[]>([]);
  const named = new Map<string, string>();
  const context: TabsContextValue = {
    current: () => {
      const wanted = selected();
      const list = tabs();
      const tab = list.find((each) => each.value === wanted);
      // A value whose tab has not rendered yet (on the server, a later tab) stays selected.
      if (wanted !== undefined && (!tab || !tab.disabled())) return wanted;
      return list.find((each) => !each.disabled())?.value;
    },
    wanted: selected,
    tabs,
    orientation: () => orientation ?? "horizontal",
    // A Tab's own `id`, else one made from its value (TASK-441 M39).
    tabId: (of) => named.get(of) ?? `${id}-tab-${fragment(of)}`,
    name: (of, tabId) => named.set(of, tabId),
    panelId: (of) => `${id}-panel-${fragment(of)}`,
  };

  // The `value` prop drives the selection when it changes.
  effect(() => {
    const next = value;
    if (next !== undefined) selected.set(next);
  });

  return (
    <TabsContext value={context}>
      <lu-tabs
        {...rest}
        ref={element}
        // The anchor the selected tab carries for a Tabs.Indicator (tabs.css).
        style={withStyle(rest.style, { "--lu-tabs-anchor": `--lu-tabs-${id}` })}
        on:valuechange={batched(() => {
          const next = element()?.value;
          if (next == null) return;
          selected.set(next);
          onValueChange?.(next);
        })}
      >
        {children}
      </lu-tabs>
    </TabsContext>
  );
}

function List({ children, activateOnFocus, loopFocus, ...rest }: TabsListProps) {
  const tabs = useTabs();
  return (
    <div
      role="tablist"
      aria-orientation={tabs.orientation() === "vertical" ? "vertical" : undefined}
      data-activate-on-focus={activateOnFocus ? "" : undefined}
      data-loop-focus={loopFocus === false ? "false" : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

function Tab({ children, value, disabled, ...rest }: TabsTabProps) {
  const tabs = useTabs();
  // A caller's `id` names it; its Panel, after it, points at that (TASK-441 M39).
  if (rest.id) tabs.name(value, rest.id);
  const record: TabRecord = { value, disabled: () => disabled === true };
  tabs.tabs.update((list) => [...list, record]);
  onCleanup(() => tabs.tabs.update((list) => list.filter((each) => each !== record)));
  const selected = () => tabs.current() === value;
  // The tab stop: the selected tab, or the first one when none is selected. The server renders
  // once, before the later tabs exist, so there it is the tab asked for (a disabled one stays
  // focusable), else the first enabled one so far: one tab stop either way (TASK-437 M17). The
  // script gives it to the selected tab.
  const stop = () => {
    if (isServer) {
      const wanted = tabs.wanted();
      return wanted === undefined ? selected() : wanted === value;
    }
    return selected() || (tabs.current() === undefined && tabs.tabs()[0] === record);
  };
  return (
    <button
      type="button"
      {...rest}
      role="tab"
      id={tabs.tabId(value)}
      value={value}
      aria-controls={tabs.panelId(value)}
      aria-selected={selected() ? "true" : "false"}
      aria-disabled={disabled ? "true" : undefined}
      tabindex={stop() ? 0 : -1}
    >
      {children}
    </button>
  );
}

function Indicator(props: TabsIndicatorProps) {
  const tabs = useTabs();
  return (
    <span {...props} aria-hidden="true" data-indicator="" hidden={tabs.current() === undefined} />
  );
}

function Panel({ children, value, ...rest }: TabsPanelProps) {
  const tabs = useTabs();
  return (
    <div
      tabindex={0}
      {...rest}
      role="tabpanel"
      id={tabs.panelId(value)}
      aria-labelledby={tabs.tabId(value)}
      hidden={tabs.current() !== value}
    >
      {children}
    </div>
  );
}

/**
 * Tabs: a tab list and the panel of the selected tab, after the APG tabs pattern. The server HTML
 * holds the whole state; `<lu-tabs>`'s small script adds the arrow keys and the selection.
 * Unstyled: style the parts through `class`, `[aria-selected]`, `[aria-disabled]` and
 * `[aria-orientation]`. An optional `Tabs.Indicator` in the list follows the selected tab.
 *
 * @example
 * <Tabs.Root defaultValue="account">
 *   <Tabs.List aria-label="Settings">
 *     <Tabs.Tab value="account">Account</Tabs.Tab>
 *     <Tabs.Tab value="password">Password</Tabs.Tab>
 *   </Tabs.List>
 *   <Tabs.Panel value="account">…</Tabs.Panel>
 *   <Tabs.Panel value="password">…</Tabs.Panel>
 * </Tabs.Root>
 */
export const Tabs = { Root, List, Tab, Indicator, Panel };
