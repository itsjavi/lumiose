// ToggleGroup (decision-62, TASK-369): `<lu-toggle-group role="group">` around Toggles, after Base
// UI's ToggleGroup. Its script (toggle-group.script.ts) presses the toggles, one at a time or with
// `multiple` any number, and gives the group one tab stop moved by the arrow keys, on server pages
// too. The `value` prop drives the element when it changes, and its `valuechange` event reports
// back through `onValueChange`.
import { effect, ref, signal, untrack } from "lumiose";
import {
  ToggleGroupContext,
  type ToggleGroupContextValue,
  type ToggleRecord,
} from "../toggle/context.ts";
import type { ToggleGroupElement } from "./toggle-group.script.ts";
import toggleGroupScript from "./toggle-group.script.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * ToggleGroup's element: property `value` (the pressed toggles' values) and `multiple`,
       * event `valuechange`.
       */
      "lu-toggle-group": JSX.HTMLProps<ToggleGroupElement> & { multiple?: boolean };
    }
  }
}

/**
 * The element props ToggleGroup passes to `<lu-toggle-group>`, without the brand of intrinsic
 * elements' props, so that `bind:value` applies to it.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<ToggleGroupElement> as K extends string ? K : never
  ]: JSX.HTMLProps<ToggleGroupElement>[K];
};

/**
 * `ToggleGroup` renders `<lu-toggle-group role="group">`. Name it with `aria-label` or
 * `aria-labelledby`. `bind:value={signal}` stands in for `value` and `onValueChange`.
 */
export interface ToggleGroupProps extends Omit<ElementProps, "children"> {
  /** Presses the toggles with these values when it changes. Pair it with `onValueChange`. */
  value?: string[];
  /** The toggles pressed at first, when `value` is left out. */
  defaultValue?: string[];
  /** Called with the pressed toggles' values after the user presses or releases one. */
  onValueChange?: (value: string[]) => void;
  /** Any number of toggles can be pressed; otherwise one at a time. */
  multiple?: boolean;
  /** The arrow keys that move between the toggles: left and right, or up and down. */
  orientation?: "horizontal" | "vertical";
  /** Arrow keys go from the last toggle to the first and back. Default `true`. */
  loopFocus?: boolean;
  /** Disables every toggle. */
  disabled?: boolean;
  /** The `Toggle`s. */
  children?: JSX.Element;
}

/**
 * A set of toggles with one value, the pressed ones: a text alignment (one at a time) or text
 * styles (`multiple`). One tab stop, arrow keys between the toggles.
 *
 * @example
 * <ToggleGroup aria-label="Alignment" defaultValue={["left"]}>
 *   <Toggle value="left">Left</Toggle>
 *   <Toggle value="center">Center</Toggle>
 * </ToggleGroup>
 */
export function ToggleGroup({
  value,
  defaultValue,
  onValueChange,
  multiple,
  orientation,
  loopFocus,
  disabled,
  children,
  ...rest
}: ToggleGroupProps) {
  // Presses the toggles and moves focus, on the server HTML and in islands (decision-63).
  toggleGroupScript();
  const element = ref<ToggleGroupElement>();
  const values = signal<readonly string[]>(untrack(() => value ?? defaultValue ?? []));
  // The `value` prop drives the toggles when it changes.
  effect(() => {
    const next = value;
    if (next === undefined) return;
    values.set(next);
    const host = element();
    if (host?.isConnected) host.value = next;
  });
  const context: ToggleGroupContextValue = {
    values,
    items: signal<ToggleRecord[]>([]),
    disabled: () => disabled === true,
  };
  return (
    <ToggleGroupContext value={context}>
      <lu-toggle-group
        {...rest}
        ref={element}
        role="group"
        multiple={multiple}
        data-orientation={orientation ?? "horizontal"}
        data-loop-focus={loopFocus === false ? "false" : undefined}
        on:valuechange={() => {
          const next = element()!.value;
          values.set(next);
          onValueChange?.(next);
        }}
      >
        {children}
      </lu-toggle-group>
    </ToggleGroupContext>
  );
}
