// `bind:value` / `bind:checked`: two-way binding to a writable signal (spec §4.5).
import { signal } from "./helpers.ts";

const name = signal("");
const quantity = signal(1);
const agreed = signal(false);

export const accepted = [
  <input bind:value={name} />,
  <input type="number" bind:value={quantity} />,
  <input type="checkbox" bind:checked={agreed} />,
  <textarea bind:value={name} />,
  <select bind:value={name}>
    <option value="a">A</option>
  </select>,
];

export const rejected = [
  // @ts-expect-error bind:value takes a writable signal, not a string.
  <input bind:value={name()} />,
  // @ts-expect-error bind:value takes a writable signal, not a string literal.
  <input bind:value="text" />,
  // @ts-expect-error a read-only getter is not writable.
  <input bind:value={() => "x"} />,
  // @ts-expect-error bind:checked needs a boolean signal.
  <input bind:checked={name} />,
  // @ts-expect-error bind:value needs a string (or number, on inputs) signal.
  <input bind:value={agreed} />,
  // @ts-expect-error bind:value is not available on a div.
  <div bind:value={name} />,
  // @ts-expect-error bind:checked only exists on input.
  <textarea bind:checked={agreed} />,
];

// `bind:x` on components (decision-62): a prop `x` with an `onXChange` callback.
declare function DialogRoot(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}): JSX.Element;
declare function ComboboxRoot(props: {
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  label: string;
}): JSX.Element;
declare function Toggle(props: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}): JSX.Element;
declare function Controlled(props: { open?: boolean }): JSX.Element;
declare function Callback(props: { onOpenChange?: (open: boolean) => void }): JSX.Element;
declare function Islandable(props: { count?: number }): JSX.Element;

const open = signal(false);
const choice = signal<string | null>(null);
const label = signal("");

export const acceptedComponents = [
  <DialogRoot bind:open={open} />,
  <DialogRoot bind:open={open} onOpenChange={(next) => console.log(next)} />,
  <ComboboxRoot bind:value={choice} label="Fruit" />,
  <ComboboxRoot bind:value={label} label="Fruit" />,
  <Toggle bind:pressed={open} />,
];

export const rejectedComponents = [
  // @ts-expect-error bind:open takes a writable signal, not its value.
  <DialogRoot bind:open={open()} />,
  // @ts-expect-error bind:open needs a boolean signal.
  <DialogRoot bind:open={label} />,
  // @ts-expect-error a component without `onOpenChange` has no bind:open.
  <Controlled bind:open={open} />,
  // @ts-expect-error a component without `open` has no bind:open.
  <Callback bind:open={open} />,
  // @ts-expect-error a component without either has no bind:count.
  <Islandable bind:count={label} />,
  // @ts-expect-error bind: does not reach an island: a signal is not serializable.
  <DialogRoot client:load bind:open={open} />,
  // @ts-expect-error without bind:pressed, the required callback is still required.
  <Toggle pressed={true} />,
];
