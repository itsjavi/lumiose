// Toggle (decision-62, TASK-369): a native `<button aria-pressed>`, pressed or not, after Base UI's
// Toggle. Its label stays the same; its state is `aria-pressed`. Inside a ToggleGroup, the group's
// element presses it (on server pages too) and it is one of the group's roving items; on its own,
// the component presses it, in an island.
import { effect, onCleanup, signal, untrack, useContext } from "lumiose";
import type { ToggleChangeDetail } from "../toggle-group/toggle-group.script.ts";
import { ToggleGroupContext, type ToggleRecord } from "./context.ts";

/**
 * The button props Toggle passes through, without the brand of intrinsic elements' props, so that
 * `bind:pressed` applies to it.
 */
type ButtonProps = Omit<JSX.IntrinsicElements["button"], symbol | "value" | "type">;

/**
 * A `<button type="button" aria-pressed>`. `bind:pressed={signal}` stands in for `pressed` and
 * `onPressedChange`.
 */
export type ToggleProps = ButtonProps & {
  /** Presses (`true`) or releases (`false`) it when it changes. Pair it with `onPressedChange`. */
  pressed?: boolean;
  /** Whether it starts pressed when `pressed` is left out. */
  defaultPressed?: boolean;
  /** Called after the user presses or releases it. */
  onPressedChange?: (pressed: boolean) => void;
  /** Its identity in a ToggleGroup's `value` (also the button's `value`). */
  value?: string;
};

/**
 * A two-state button: bold, mute, pin. Unstyled: style it through `class`, `[aria-pressed="true"]`,
 * `:disabled` and `:focus-visible`.
 *
 * @example
 * <Toggle aria-label="Bold" bind:pressed={bold}>B</Toggle>
 */
export function Toggle({
  pressed,
  defaultPressed,
  onPressedChange,
  value,
  children,
  ...rest
}: ToggleProps) {
  const group = useContext(ToggleGroupContext);
  // Standalone: the component holds the state; in a group, the group's element and value do.
  const state = signal(untrack(() => pressed ?? defaultPressed ?? false));
  effect(() => {
    if (pressed !== undefined) state.set(pressed);
  });
  const record: ToggleRecord = { value, disabled: () => rest.disabled === true };
  if (group) {
    group.items.update((list) => [...list, record]);
    onCleanup(() => group.items.update((list) => list.filter((each) => each !== record)));
  }
  const on = () => (group ? value !== undefined && group.values().includes(value) : state());
  /**
   * The group's tab stop in the server HTML: its first pressed toggle, or its first enabled one
   * when none is pressed. The element keeps it from then on.
   */
  const stop = untrack(() => {
    if (!group) return undefined;
    const usable = group.items().filter((each) => !each.disabled() && !group.disabled());
    const values = group.values();
    const first =
      values.length > 0
        ? usable.find((each) => each.value !== undefined && values.includes(each.value))
        : usable[0];
    return first === record ? 0 : -1;
  });
  return (
    <button
      type="button"
      tabindex={stop}
      {...rest}
      disabled={rest.disabled || group?.disabled() || undefined}
      value={value}
      aria-pressed={on() ? "true" : "false"}
      on:click={(event: MouseEvent) => {
        // In a group, the group's element presses it and reports `pressedchange`.
        if (group || event.defaultPrevented) return;
        const next = !state();
        state.set(next);
        onPressedChange?.(next);
      }}
      on:pressedchange={(event: CustomEvent<ToggleChangeDetail>) =>
        onPressedChange?.(event.detail.pressed)
      }
    >
      {children}
    </button>
  );
}
