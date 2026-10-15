// Button (decision-62, TASK-364): a native `<button>`, after Base UI's Button. `type` defaults to
// `"button"`, so a Button in a form submits only when asked to. Disabled it is natively disabled
// (out of the tab order); with `focusableWhenDisabled` it stays focusable as
// `aria-disabled="true"` and button.script.ts cancels its clicks.
import buttonScript from "./button.script.ts?client";

/** A native `<button>`, with every native prop (`type`, `name`, `value`, `form`, `command`, …). */
export type ButtonProps = JSX.IntrinsicElements["button"] & {
  /**
   * Keeps the button focusable while `disabled`: it becomes `aria-disabled="true"` instead of
   * natively disabled, so focus stays on it (a loading state, say) and screen readers still find
   * it; its clicks are ignored.
   */
  focusableWhenDisabled?: boolean;
};

/**
 * A native button. Unstyled: style it through `class` and `:disabled`, `[aria-disabled="true"]`,
 * `:focus-visible`, `:hover`.
 *
 * @example
 * <Button type="submit" disabled={saving()} focusableWhenDisabled>
 *   {saving() ? "Saving…" : "Save"}
 * </Button>
 */
export function Button({ children, disabled, focusableWhenDisabled, ...rest }: ButtonProps) {
  // Cancels the clicks of `aria-disabled` buttons; the page loads it once (decision-63).
  buttonScript();
  const soft = () => disabled === true && focusableWhenDisabled === true;
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled === true && !soft()}
      aria-disabled={soft() ? "true" : rest["aria-disabled"]}
    >
      {children}
    </button>
  );
}
